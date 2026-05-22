// smoke-proxy — operator probe that GETs https://api.ipify.org through
// the iogrid residential SOCKS5+TLS proxy and asserts the returned IP is
// NOT the local egress IP. Exits non-zero on any failure.
//
// Usage:
//
//	IOGRID_WORKSPACE=vcard \
//	IOGRID_API_KEY=iog_... \
//	IOGRID_PROXY_URL=proxy.iogrid.org:443 \
//	go run ./services/vcard-api/cmd/smoke-proxy
//
// Wired from api/Makefile as `make smoke-proxy`.
//
// Why this exists: the LinkedIn enrichment client (services/vcard-api/
// enrich/linkedin.go) ALWAYS returns 200 with empty fields on transport
// failure — graceful-skip is the contract. That hides a misconfigured
// proxy in production. This probe fails LOUDLY so operators catch
// IOGRID_API_KEY rotations, gateway outages, and Traefik mis-wiring
// before a real LinkedIn lookup silently degrades.
package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/dynolabs-io/api/services/vcard-api/enrich"
)

func main() {
	if err := run(); err != nil {
		log.Fatalf("smoke-proxy FAIL: %v", err)
	}
	log.Print("smoke-proxy PASS")
}

func run() error {
	client := enrich.LinkedInFromEnv()
	if !client.Enabled() {
		return errors.New("client disabled — set IOGRID_API_KEY + IOGRID_WORKSPACE + IOGRID_PROXY_URL")
	}
	if client.HTTP == nil {
		return errors.New("client.HTTP nil despite Enabled() — proxy URL likely unparseable")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 25*time.Second)
	defer cancel()

	directIP, err := localEgressIP(ctx)
	if err != nil {
		log.Printf("smoke-proxy: could not determine local egress IP (continuing): %v", err)
	} else {
		log.Printf("smoke-proxy: local egress IP = %s", directIP)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://api.ipify.org?format=json", nil)
	if err != nil {
		return fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("User-Agent", "vcard-smoke-proxy/0.1")

	t0 := time.Now()
	resp, err := client.HTTP.Do(req)
	if err != nil {
		return fmt.Errorf("proxy fetch failed: %w", err)
	}
	defer resp.Body.Close()
	latency := time.Since(t0)

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("ipify returned status %d, want 200", resp.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, 4<<10))
	if err != nil {
		return fmt.Errorf("read body: %w", err)
	}

	var got struct {
		IP string `json:"ip"`
	}
	if err := json.Unmarshal(body, &got); err != nil {
		return fmt.Errorf("decode ipify json %q: %w", string(body), err)
	}
	got.IP = strings.TrimSpace(got.IP)
	if got.IP == "" {
		return fmt.Errorf("ipify returned empty ip field, body=%q", string(body))
	}

	log.Printf("smoke-proxy: proxied egress IP = %s (latency %dms)", got.IP, latency.Milliseconds())
	if directIP != "" && got.IP == directIP {
		return fmt.Errorf("proxy egress IP %s == local egress IP %s — proxy not in path", got.IP, directIP)
	}
	return nil
}

// localEgressIP discovers the local egress IP by GET-ing api.ipify.org
// WITHOUT the proxy so we can compare against the proxied result. Failure
// is non-fatal — we just log "could not determine" and skip the equality
// assertion (the proxy fetch alone still proves transport works).
func localEgressIP(ctx context.Context) (string, error) {
	c := &http.Client{
		Timeout: 5 * time.Second,
		Transport: &http.Transport{
			DialContext: (&net.Dialer{Timeout: 4 * time.Second}).DialContext,
			// No proxy wired — this hits ipify directly.
		},
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://api.ipify.org?format=json", nil)
	if err != nil {
		return "", err
	}
	resp, err := c.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 4<<10))
	if err != nil {
		return "", err
	}
	var got struct {
		IP string `json:"ip"`
	}
	if err := json.Unmarshal(body, &got); err != nil {
		return "", err
	}
	return strings.TrimSpace(got.IP), nil
}

