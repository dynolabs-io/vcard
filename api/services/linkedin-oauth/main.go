// linkedin-oauth: handles the OAuth 2.0 Authorization Code flow for LinkedIn.
//
// Flow:
//   1. POST /oauth/linkedin/authorize?state=&redirect= → returns LinkedIn auth URL
//   2. App opens that URL via ASWebAuthenticationSession with the app's
//      private redirect scheme as the close-detector.
//   3. User auths → LinkedIn → /oauth/linkedin/callback?code= → we exchange
//      for a token, fetch /v2/userinfo, stash the profile keyed by state,
//      then redirect the browser to a tiny https URL that just renders
//      "you can close this".
//   4. ASWebAuthenticationSession detects the redirect scheme and closes.
//      App calls /oauth/linkedin/result?state= → returns the profile JSON.
//
// We do NOT shove a base64-encoded profile into the redirect URL anymore —
// that triggered LinkedIn's anti-abuse "check your LinkedIn app" interstitial
// because the URL was unusually long.
//
// State store is in-process (single replica). 10-minute TTL. State is ALSO
// the result key, but we delete it after first read so a leak doesn't replay.

package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/dynolabs-io/api/shared/health"
)

var version = "dev"

type stateEntry struct {
	redirect string         // app's deep-link, e.g. dynolabs-vcard://oauth/linkedin
	profile  *linkedInProfile
	expires  time.Time
}

type stateStore struct {
	mu sync.Mutex
	m  map[string]*stateEntry
}

func (s *stateStore) put(state, redirect string, ttl time.Duration) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.m[state] = &stateEntry{redirect: redirect, expires: time.Now().Add(ttl)}
	for k, v := range s.m {
		if time.Now().After(v.expires) {
			delete(s.m, k)
		}
	}
}

func (s *stateStore) get(state string) (*stateEntry, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	v, ok := s.m[state]
	if !ok || time.Now().After(v.expires) {
		delete(s.m, state)
		return nil, false
	}
	return v, true
}

func (s *stateStore) setProfile(state string, p *linkedInProfile) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	v, ok := s.m[state]
	if !ok {
		return false
	}
	v.profile = p
	return true
}

func (s *stateStore) takeProfile(state string) (*linkedInProfile, string, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	v, ok := s.m[state]
	if !ok || v.profile == nil {
		return nil, "", false
	}
	delete(s.m, state)
	return v.profile, v.redirect, true
}

type linkedInProfile struct {
	Sub        string `json:"sub"`
	Email      string `json:"email"`
	Name       string `json:"name"`
	Picture    string `json:"picture,omitempty"`
	GivenName  string `json:"given_name,omitempty"`
	FamilyName string `json:"family_name,omitempty"`
	// Vanity is the LinkedIn URL slug ("satyanadella" from
	// linkedin.com/in/satyanadella). Best-effort: we try the `vanityName`
	// claim if LinkedIn returns it, else parse `/in/<slug>` from the
	// `profile` URL claim. Empty when LinkedIn ships neither — the
	// downstream iogrid LinkedIn-vanity enrichment then no-ops gracefully.
	Vanity string `json:"vanity,omitempty"`
}

// userinfoRaw mirrors every claim we care about from LinkedIn's
// /v2/userinfo response. We decode into this and then derive linkedInProfile.
type userinfoRaw struct {
	Sub        string `json:"sub"`
	Email      string `json:"email"`
	Name       string `json:"name"`
	Picture    string `json:"picture,omitempty"`
	GivenName  string `json:"given_name,omitempty"`
	FamilyName string `json:"family_name,omitempty"`
	// LinkedIn-specific extensions present on some apps' OIDC responses:
	VanityName string `json:"vanityName,omitempty"` // direct slug, when present
	Profile    string `json:"profile,omitempty"`    // public URL form, e.g. https://www.linkedin.com/in/<slug>
}

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	clientID := os.Getenv("LINKEDIN_CLIENT_ID")
	clientSecret := os.Getenv("LINKEDIN_CLIENT_SECRET")
	callbackURL := getenv("LINKEDIN_CALLBACK_URL", "https://api.dynolabs.io/oauth/linkedin/callback")
	stub := clientID == "" || clientSecret == ""

	store := &stateStore{m: map[string]*stateEntry{}}

	mux := http.NewServeMux()
	mux.Handle("GET /healthz", health.Handler("linkedin-oauth", version))
	mux.Handle("GET /oauth/healthz", health.Handler("linkedin-oauth", version))
	readyz := func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		fmt.Fprintf(w, `{"ready":true,"stub":%t}`, stub)
	}
	mux.HandleFunc("GET /readyz", readyz)
	mux.HandleFunc("GET /oauth/readyz", readyz)

	mux.HandleFunc("GET /oauth/linkedin/authorize", func(w http.ResponseWriter, r *http.Request) {
		if stub {
			http.Error(w, `{"error":"stub-mode: LinkedIn OAuth app not yet configured"}`, http.StatusServiceUnavailable)
			return
		}
		state := r.URL.Query().Get("state")
		redirect := r.URL.Query().Get("redirect")
		if state == "" || redirect == "" {
			http.Error(w, `{"error":"state and redirect required"}`, http.StatusBadRequest)
			return
		}
		store.put(state, redirect, 10*time.Minute)
		params := url.Values{}
		params.Set("response_type", "code")
		params.Set("client_id", clientID)
		params.Set("redirect_uri", callbackURL)
		params.Set("scope", "openid profile email")
		params.Set("state", state)
		authURL := "https://www.linkedin.com/oauth/v2/authorization?" + params.Encode()
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"url": authURL})
	})

	mux.HandleFunc("GET /oauth/linkedin/callback", func(w http.ResponseWriter, r *http.Request) {
		if stub {
			http.Error(w, `{"error":"stub-mode"}`, http.StatusServiceUnavailable)
			return
		}
		q := r.URL.Query()
		state := q.Get("state")
		code := q.Get("code")
		if errCode := q.Get("error"); errCode != "" {
			http.Error(w, `{"error":"linkedin: `+errCode+`"}`, http.StatusBadRequest)
			return
		}
		if state == "" || code == "" {
			http.Error(w, `{"error":"missing state or code"}`, http.StatusBadRequest)
			return
		}
		entry, ok := store.get(state)
		if !ok {
			http.Error(w, `{"error":"unknown or expired state"}`, http.StatusBadRequest)
			return
		}

		profile, err := exchangeAndFetch(r.Context(), clientID, clientSecret, callbackURL, code)
		if err != nil {
			slog.Error("linkedin exchange failed", "err", err)
			http.Error(w, `{"error":"linkedin exchange failed"}`, http.StatusBadGateway)
			return
		}
		store.setProfile(state, profile)

		// Redirect to the app's deep-link with NOTHING in the URL except
		// the state. The app uses state to claim the profile via
		// /oauth/linkedin/result. URL stays short → no LinkedIn
		// "check your LinkedIn app" interstitial.
		sep := "?"
		if strings.Contains(entry.redirect, "?") {
			sep = "&"
		}
		final := entry.redirect + sep + "state=" + url.QueryEscape(state)
		http.Redirect(w, r, final, http.StatusFound)
	})

	// App polls this once after the auth session closes. Returns the
	// profile JSON exactly once per state, then deletes the entry.
	mux.HandleFunc("GET /oauth/linkedin/result", func(w http.ResponseWriter, r *http.Request) {
		state := r.URL.Query().Get("state")
		if state == "" {
			http.Error(w, `{"error":"state required"}`, http.StatusBadRequest)
			return
		}
		profile, _, ok := store.takeProfile(state)
		if !ok {
			http.Error(w, `{"error":"not ready or already claimed"}`, http.StatusNotFound)
			return
		}
		// Field-presence logging just before emission to client.
		slog.Info("linkedin result emitted to client",
			"hasSub", profile.Sub != "",
			"hasName", profile.Name != "",
			"hasEmail", profile.Email != "",
			"hasPicture", profile.Picture != "",
			"hasVanity", profile.Vanity != "",
		)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(profile)
	})

	addr := getenv("LISTEN_ADDR", ":8080")
	srv := &http.Server{Addr: addr, Handler: mux, ReadHeaderTimeout: 10 * time.Second}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	go func() {
		slog.Info("linkedin-oauth listening", "addr", addr, "version", version, "stub", stub, "callback", callbackURL)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("listen failed", "err", err)
			os.Exit(1)
		}
	}()
	<-ctx.Done()
	slog.Info("shutting down")
	shutCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = srv.Shutdown(shutCtx)
}

func exchangeAndFetch(ctx context.Context, clientID, clientSecret, callbackURL, code string) (*linkedInProfile, error) {
	tokCtx, cancel := context.WithTimeout(ctx, 8*time.Second)
	defer cancel()

	form := url.Values{}
	form.Set("grant_type", "authorization_code")
	form.Set("code", code)
	form.Set("redirect_uri", callbackURL)
	form.Set("client_id", clientID)
	form.Set("client_secret", clientSecret)

	req, _ := http.NewRequestWithContext(tokCtx, "POST", "https://www.linkedin.com/oauth/v2/accessToken", strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("token request: %w", err)
	}
	defer res.Body.Close()
	body, _ := io.ReadAll(res.Body)
	if res.StatusCode != 200 {
		return nil, fmt.Errorf("token %d: %s", res.StatusCode, string(body))
	}
	var tok struct {
		AccessToken string `json:"access_token"`
	}
	if err := json.Unmarshal(body, &tok); err != nil {
		return nil, fmt.Errorf("token decode: %w", err)
	}
	if tok.AccessToken == "" {
		return nil, fmt.Errorf("empty access_token")
	}

	pCtx, pcancel := context.WithTimeout(ctx, 8*time.Second)
	defer pcancel()
	preq, _ := http.NewRequestWithContext(pCtx, "GET", "https://api.linkedin.com/v2/userinfo", nil)
	preq.Header.Set("Authorization", "Bearer "+tok.AccessToken)
	pres, err := http.DefaultClient.Do(preq)
	if err != nil {
		return nil, fmt.Errorf("userinfo request: %w", err)
	}
	defer pres.Body.Close()
	pbody, _ := io.ReadAll(pres.Body)
	if pres.StatusCode != 200 {
		return nil, fmt.Errorf("userinfo %d: %s", pres.StatusCode, string(pbody))
	}
	var ui userinfoRaw
	if err := json.Unmarshal(pbody, &ui); err != nil {
		return nil, fmt.Errorf("userinfo decode: %w", err)
	}
	p := linkedInProfile{
		Sub:        ui.Sub,
		Email:      ui.Email,
		Name:       ui.Name,
		Picture:    ui.Picture,
		GivenName:  ui.GivenName,
		FamilyName: ui.FamilyName,
		Vanity:     deriveVanity(ui.VanityName, ui.Profile),
	}
	// Field-presence logging (no PII) so we can diagnose missing-email
	// reports. Also captures the raw key list LinkedIn returned in case
	// the field name has drifted.
	var raw map[string]json.RawMessage
	_ = json.Unmarshal(pbody, &raw)
	keys := make([]string, 0, len(raw))
	for k := range raw {
		keys = append(keys, k)
	}
	slog.Info("linkedin userinfo decoded",
		"hasSub", p.Sub != "",
		"hasName", p.Name != "",
		"hasEmail", p.Email != "",
		"hasPicture", p.Picture != "",
		"hasVanity", p.Vanity != "",
		"vanitySource", vanitySource(ui.VanityName, ui.Profile),
		"rawKeys", keys,
	)
	return &p, nil
}

// deriveVanity tries the direct `vanityName` claim first, then parses
// `/in/<slug>` out of the `profile` URL claim. Returns "" when neither
// is usable — downstream iogrid enrichment then no-ops by design.
func deriveVanity(vanityName, profileURL string) string {
	if v := strings.TrimSpace(vanityName); v != "" {
		return v
	}
	u := strings.TrimSpace(profileURL)
	if u == "" {
		return ""
	}
	// We accept either fully-qualified URLs or paths. Strip scheme/host.
	if i := strings.Index(u, "://"); i >= 0 {
		u = u[i+3:]
	}
	if i := strings.Index(u, "/"); i >= 0 {
		u = u[i:]
	}
	const marker = "/in/"
	i := strings.Index(u, marker)
	if i < 0 {
		return ""
	}
	rest := u[i+len(marker):]
	// Slug ends at the first '/', '?', '#', or end-of-string.
	end := len(rest)
	for j, c := range rest {
		if c == '/' || c == '?' || c == '#' {
			end = j
			break
		}
	}
	return strings.TrimSpace(rest[:end])
}

// vanitySource is a log-only tag so we can tell whether the slug came
// from a direct claim or from URL parsing without re-shipping the
// underlying values.
func vanitySource(vanityName, profileURL string) string {
	if strings.TrimSpace(vanityName) != "" {
		return "vanityName"
	}
	if strings.TrimSpace(profileURL) != "" {
		return "profileURL"
	}
	return "none"
}

func getenv(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}
