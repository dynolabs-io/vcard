// linkedin-fetch — operator probe that GETs https://www.linkedin.com/in/<vanity>
// through the iogrid residential SOCKS5+TLS proxy and writes the raw HTML
// response body to -out. Mirrors smoke-proxy's transport wiring but for the
// HTML-yielding LinkedIn endpoint that the screenshot pipeline needs.
//
// Usage:
//
//	IOGRID_WORKSPACE=vcard-prod \
//	IOGRID_API_KEY=iog_... \
//	IOGRID_PROXY_URL=proxy.iogrid.org:443 \
//	go run ./services/vcard-api/cmd/linkedin-fetch \
//	  -vanity satyanadella -out /tmp/linkedin-via-iogrid.html -timeout 90s
//
// The -timeout flag exists because the canonical enrich.NewLinkedInClient
// hardcodes a 20s budget — too tight for first-fetch through a fresh
// cross-continent residential proxy chain. This binary lets the operator
// extend the budget when validating new provider regions.
//
// Wired into api/test/playwright/linkedin-import-via-iogrid.spec.ts as
// the artifact-producing step before the Playwright screenshot.
package main

import (
	"context"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/dynolabs-io/api/services/vcard-api/enrich"
)

func main() {
	vanity := flag.String("vanity", "satyanadella", "LinkedIn vanity to fetch")
	outPath := flag.String("out", "/tmp/linkedin-via-iogrid.html", "where to write the raw HTML body")
	timeout := flag.Duration("timeout", 90*time.Second, "HTTP client timeout")
	flag.Parse()

	if err := run(*vanity, *outPath, *timeout); err != nil {
		log.Fatalf("linkedin-fetch FAIL: %v", err)
	}
}

func run(vanity, outPath string, timeout time.Duration) error {
	client := enrich.LinkedInFromEnv()
	if !client.Enabled() {
		return fmt.Errorf("client disabled — set IOGRID_API_KEY + IOGRID_WORKSPACE + IOGRID_PROXY_URL")
	}
	if client.HTTP == nil {
		return fmt.Errorf("client.HTTP nil despite Enabled() — proxy URL likely unparseable")
	}

	client.HTTP.Timeout = timeout

	ctx, cancel := context.WithTimeout(context.Background(), timeout+5*time.Second)
	defer cancel()

	target := "https://www.linkedin.com/in/" + vanity
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, target, nil)
	if err != nil {
		return fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("User-Agent", client.UserAgent)
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
	req.Header.Set("Accept-Language", "en-US,en;q=0.9")

	t0 := time.Now()
	resp, err := client.HTTP.Do(req)
	if err != nil {
		return fmt.Errorf("proxy fetch failed: %w", err)
	}
	defer resp.Body.Close()
	headerLatency := time.Since(t0)

	body, err := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	if err != nil {
		return fmt.Errorf("read body: %w", err)
	}
	totalLatency := time.Since(t0)

	if err := os.WriteFile(outPath, body, 0o644); err != nil {
		return fmt.Errorf("write %s: %w", outPath, err)
	}

	log.Printf("linkedin-fetch: status=%d header_latency=%dms total_latency=%dms bytes=%d out=%s",
		resp.StatusCode, headerLatency.Milliseconds(), totalLatency.Milliseconds(), len(body), outPath)

	if resp.StatusCode >= 400 {
		return fmt.Errorf("LinkedIn returned status %d — see body at %s for the response shape", resp.StatusCode, outPath)
	}
	return nil
}
