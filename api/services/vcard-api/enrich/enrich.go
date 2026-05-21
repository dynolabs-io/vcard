// Package enrich — fetches title/company/photo for a LinkedIn vanity slug
// by tunnelling the GET https://www.linkedin.com/in/<vanity> through
// iogrid's residential SOCKS5+TLS proxy and parsing og:title / og:image
// out of LinkedIn's public-profile SSR markup.
//
// Endpoint:
//
//	POST /v1/enrich/linkedin   body {"vanity": "satyanadella"}
//	                           resp {"title", "company", "companyDomain",
//	                                 "linkedinUrl", "photoUrl"}
//
// Apollo.io was the previous primary enrichment path and has been
// removed (founder rule 2026-05-21: free tier returns empty payloads,
// not worth carrying the code). LinkedIn-via-iogrid is now the only
// enrichment provider — graceful-skip contract preserved (returns 200
// with empty fields when IOGRID_* env unset, when the iogrid mesh has
// no eligible provider online, or when LinkedIn returns non-200).
package enrich

import (
	"encoding/json"
	"net/http"
	"strings"
)

// Result is the public response shape. Empty fields = unknown — the
// mobile caller treats enrichment as best-effort and falls back to
// whatever the user already typed.
type Result struct {
	Title         string `json:"title"`
	Company       string `json:"company"`
	CompanyDomain string `json:"companyDomain"`
	LinkedInURL   string `json:"linkedinUrl"`
	PhotoURL      string `json:"photoUrl"`
}

// Handlers wires the LinkedIn-via-iogrid enrichment endpoint into the
// http.ServeMux. LinkedIn may be a no-op client (empty config) — the
// endpoint still responds 200 with an empty Result.
type Handlers struct {
	LinkedIn   *LinkedInClient
	AuthVerify func(r *http.Request) string // returns "" if unauthenticated
}

func (h *Handlers) Mount(mux *http.ServeMux) {
	mux.HandleFunc("POST /v1/enrich/linkedin", h.enrichLinkedIn)
}

type enrichLinkedInReq struct {
	Vanity string `json:"vanity"`
}

func (h *Handlers) enrichLinkedIn(w http.ResponseWriter, r *http.Request) {
	if h.AuthVerify != nil && h.AuthVerify(r) == "" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "auth required"})
		return
	}
	var req enrichLinkedInReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
		return
	}
	if strings.TrimSpace(req.Vanity) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "vanity required"})
		return
	}
	out, _ := h.LinkedIn.EnrichByVanity(r.Context(), req.Vanity)
	if out.LinkedInURL != "" && out.Company != "" && out.CompanyDomain == "" {
		// Derive a company-domain heuristic from the LinkedIn-extracted
		// company name when the response didn't include one. Used by the
		// mobile client to fetch a Clearbit-style brand logo.
		out.CompanyDomain = guessDomain(out.Company)
	}
	writeJSON(w, http.StatusOK, out)
}

// guessDomain turns a company display name into a likely public domain
// (e.g., "Microsoft" → "microsoft.com"). Best-effort — empty when the
// name contains characters that don't survive the DNS-safe normalisation.
func guessDomain(company string) string {
	s := strings.ToLower(strings.TrimSpace(company))
	if s == "" {
		return ""
	}
	out := make([]byte, 0, len(s))
	for i := 0; i < len(s); i++ {
		c := s[i]
		switch {
		case c >= 'a' && c <= 'z', c >= '0' && c <= '9':
			out = append(out, c)
		}
	}
	if len(out) == 0 {
		return ""
	}
	return string(out) + ".com"
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
