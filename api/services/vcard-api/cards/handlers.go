package cards

import (
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
)

type Handlers struct {
	Repo *Repo
	// AuthVerify returns the authenticated user_id from the Authorization
	// header (or "" if missing/invalid). Set by main from the auth
	// Verifier. Optional — if nil, all calls are treated as anonymous
	// device-bound (legacy behavior).
	AuthVerify func(r *http.Request) string
}

func (h *Handlers) userID(r *http.Request) string {
	if h.AuthVerify == nil {
		return ""
	}
	return h.AuthVerify(r)
}

func (h *Handlers) Mount(mux *http.ServeMux) {
	mux.HandleFunc("POST /v1/cards", h.create)
	mux.HandleFunc("GET /v1/cards", h.list)
	mux.HandleFunc("GET /v1/cards/{id}", h.get)
	mux.HandleFunc("PATCH /v1/cards/{id}", h.update)
	mux.HandleFunc("DELETE /v1/cards/{id}", h.delete)
	// Public — recipients hitting the web-profile use this via web-profile's
	// in-cluster fetch. Also useful for the direct integration tests.
	mux.HandleFunc("GET /v1/c/{slug}", h.publicBySlug)
	// Mobile crash log sink — writes to slog so we can read in `kubectl logs`.
	mux.HandleFunc("POST /v1/crash", h.crash)
	// Anonymous reach analytics — web-profile + pass-signer fire-and-forget
	// POST here when a recipient hits a public surface. Inserts a row in
	// scan_events. See TBD-V05 (#9). NO PII: callers send the low-cardinality
	// bucket (city/country/uaFamily) NOT the raw IP / User-Agent.
	mux.HandleFunc("POST /v1/internal/scan-events", h.recordScanEvent)
	// Inbox reach analytics — card-owner-only aggregation over scan_events.
	// See TBD-V08 (#15). Returns totals + per-day + UA-family breakdown.
	mux.HandleFunc("GET /v1/inbox/reach", h.inboxReach)
}

// inboxReach aggregates scan_events for the authed user's own card.
// Returns 401 if unauthenticated, 400 if slug missing, 403 if the slug
// belongs to a different user, 200 + ReachStats JSON otherwise.
//
// Owner-scope is the privacy boundary — without it, any signed-in user
// could enumerate reach numbers for arbitrary public slugs.
func (h *Handlers) inboxReach(w http.ResponseWriter, r *http.Request) {
	uid := h.userID(r)
	if uid == "" {
		writeErr(w, http.StatusUnauthorized, "auth required")
		return
	}
	slug := strings.TrimSpace(r.URL.Query().Get("slug"))
	if slug == "" {
		writeErr(w, http.StatusBadRequest, "slug required")
		return
	}
	// Optional ?days= window (default 30, clamped 1..90 in repo)
	days := 0
	if d := r.URL.Query().Get("days"); d != "" {
		days, _ = strconv.Atoi(d)
	}
	// Owner-scope: look up the card and confirm ownership.
	card, err := h.Repo.GetBySlug(r.Context(), slug)
	if err != nil {
		respondNotFoundOr500(w, err)
		return
	}
	if card.UserID == "" || card.UserID != uid {
		writeErr(w, http.StatusForbidden, "card not owned by caller")
		return
	}
	stats, err := h.Repo.ReachStatsBySlug(r.Context(), slug, days)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"slug":     slug,
		"totals":   stats.Totals,
		"byDay":    stats.ByDay,
		"uaFamily": stats.UAFamily,
	})
}

// scanEventReq is the body of POST /v1/internal/scan-events. All bucketed
// fields are optional; only targetSlug + kind are required.
type scanEventReq struct {
	TargetSlug string `json:"targetSlug"`
	Kind       string `json:"kind"`
	City       string `json:"city,omitempty"`
	Country    string `json:"country,omitempty"`
	UAFamily   string `json:"uaFamily,omitempty"`
}

// validKind enumerates the canonical kinds. Migration comment in this
// package lists "vcf"/"profile"/"pkpass" — keep aligned.
var validKind = map[string]bool{"profile": true, "vcf": true, "pkpass": true}

func (h *Handlers) recordScanEvent(w http.ResponseWriter, r *http.Request) {
	var req scanEventReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	if req.TargetSlug == "" || !validKind[req.Kind] {
		writeErr(w, http.StatusBadRequest, "targetSlug + kind ∈ {profile,vcf,pkpass} required")
		return
	}
	// Fire-and-forget at the caller; this handler does the work synchronously
	// but always returns 204. Failure is logged, never surfaced — analytics
	// can't bite the public-profile experience.
	if err := h.Repo.RecordScanEvent(r.Context(), req.TargetSlug, req.Kind, req.City, req.Country, req.UAFamily); err != nil {
		slog.Warn("scan_events insert failed", "slug", req.TargetSlug, "kind", req.Kind, "err", err)
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handlers) crash(w http.ResponseWriter, r *http.Request) {
	body, _ := io.ReadAll(io.LimitReader(r.Body, 64*1024))
	slog.Error("mobile-crash", "body", string(body), "ua", r.UserAgent())
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handlers) create(w http.ResponseWriter, r *http.Request) {
	var c Card
	if err := json.NewDecoder(r.Body).Decode(&c); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	if c.Name == "" {
		writeErr(w, http.StatusBadRequest, "name required")
		return
	}
	if err := h.Repo.Create(r.Context(), &c); err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	// If the caller is signed in, attach the user_id so this card syncs
	// across the user's other devices. Anonymous cards stay device-bound.
	if uid := h.userID(r); uid != "" {
		if err := h.Repo.SetUser(r.Context(), c.ID, uid); err == nil {
			c.UserID = uid
		}
	}
	writeJSON(w, http.StatusCreated, c)
}

func (h *Handlers) list(w http.ResponseWriter, r *http.Request) {
	// Signed-in path: union of the user's cards + any device cards on
	// THIS device that don't yet have a user_id (lets us show
	// not-yet-claimed local cards alongside synced ones until the
	// caller hits the claim endpoint).
	if uid := h.userID(r); uid != "" {
		out, err := h.Repo.ListByUser(r.Context(), uid)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		deviceID := r.URL.Query().Get("device_id")
		if deviceID != "" {
			dev, err := h.Repo.ListByDeviceUnclaimed(r.Context(), deviceID)
			if err == nil {
				seen := make(map[string]bool, len(out))
				for _, c := range out {
					seen[c.ID] = true
				}
				for _, c := range dev {
					if !seen[c.ID] {
						out = append(out, c)
					}
				}
			}
		}
		if out == nil {
			out = []Card{}
		}
		writeJSON(w, http.StatusOK, out)
		return
	}
	// Anonymous path: device-bound.
	deviceID := r.URL.Query().Get("device_id")
	if deviceID == "" {
		writeErr(w, http.StatusBadRequest, "device_id required")
		return
	}
	// Anonymous path: device-bound + UNCLAIMED only. Anyone holding the
	// device_id (which may be logged by intermediate proxies / analytics)
	// must not be able to enumerate cards that have been attached to a
	// user account. See TBD-V13 (#23).
	cards, err := h.Repo.ListByDeviceUnclaimed(r.Context(), deviceID)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	if cards == nil {
		cards = []Card{}
	}
	writeJSON(w, http.StatusOK, cards)
}

func (h *Handlers) get(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	c, err := h.Repo.GetByID(r.Context(), id)
	if err != nil {
		respondNotFoundOr500(w, err)
		return
	}
	writeJSON(w, http.StatusOK, c)
}

func (h *Handlers) publicBySlug(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")
	c, err := h.Repo.GetBySlug(r.Context(), slug)
	if err != nil {
		respondNotFoundOr500(w, err)
		return
	}
	// Strip device_id from the public projection.
	c.DeviceID = ""
	writeJSON(w, http.StatusOK, c)
}

func (h *Handlers) update(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	// PATCH is partial-update — ONLY fields present in the request body
	// are updated. Fields omitted from the JSON body keep their existing
	// DB value. Pre-2026-05-23 this decoded into a Card{} zero-value
	// struct and the repo wrote every column, so a partial PATCH like
	// {"photoUrl":"…"} silently zeroed name/title/company/emails/phones/
	// socials. See TBD-V06 (#10) for the bug + walk #3 evidence.
	var patch map[string]json.RawMessage
	if err := json.NewDecoder(r.Body).Decode(&patch); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	if len(patch) == 0 {
		writeErr(w, http.StatusBadRequest, "empty patch body")
		return
	}
	updated, err := h.Repo.Patch(r.Context(), id, patch)
	if err != nil {
		respondNotFoundOr500(w, err)
		return
	}
	writeJSON(w, http.StatusOK, updated)
}

func (h *Handlers) delete(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := h.Repo.Delete(r.Context(), id); err != nil {
		respondNotFoundOr500(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func respondNotFoundOr500(w http.ResponseWriter, err error) {
	if errors.Is(err, ErrNotFound) {
		writeErr(w, http.StatusNotFound, "not found")
		return
	}
	writeErr(w, http.StatusInternalServerError, err.Error())
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func writeErr(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}
