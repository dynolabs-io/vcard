package enrich

import (
	"context"
	"errors"
	"testing"
)

func TestMergeEnrich(t *testing.T) {
	tests := []struct {
		name              string
		primary, fallback Result
		want              Result
	}{
		{
			name:     "primary wins on all populated",
			primary:  Result{Title: "CEO", Company: "Foo", CompanyDomain: "foo.com", LinkedInURL: "u1", PhotoURL: "p1"},
			fallback: Result{Title: "CTO", Company: "Bar", CompanyDomain: "bar.com", LinkedInURL: "u2", PhotoURL: "p2"},
			want:     Result{Title: "CEO", Company: "Foo", CompanyDomain: "foo.com", LinkedInURL: "u1", PhotoURL: "p1"},
		},
		{
			name:     "fallback fills empty title + company",
			primary:  Result{LinkedInURL: "u1"},
			fallback: Result{Title: "CTO", Company: "Bar", PhotoURL: "p2"},
			want:     Result{Title: "CTO", Company: "Bar", LinkedInURL: "u1", PhotoURL: "p2"},
		},
		{
			name:     "fallback fills CompanyDomain when primary empty",
			primary:  Result{Title: "CEO"},
			fallback: Result{Company: "Bar", CompanyDomain: "bar.com"},
			want:     Result{Title: "CEO", Company: "Bar", CompanyDomain: "bar.com"},
		},
		{
			name:     "both empty stays empty",
			primary:  Result{},
			fallback: Result{},
			want:     Result{},
		},
		{
			name:     "primary partial company kept, title filled",
			primary:  Result{Company: "Microsoft", PhotoURL: "p1"},
			fallback: Result{Title: "Chairman and CEO at Microsoft", Company: "DontOverwrite"},
			want:     Result{Title: "Chairman and CEO at Microsoft", Company: "Microsoft", PhotoURL: "p1"},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := mergeEnrich(tt.primary, tt.fallback); got != tt.want {
				t.Errorf("mergeEnrich() = %+v, want %+v", got, tt.want)
			}
		})
	}
}

func TestShouldChainLinkedIn(t *testing.T) {
	enabledClient := NewLinkedInClient("iog_x", "ws", "proxy.iogrid.org:443")
	disabledClient := NewLinkedInClient("", "", "")
	lookup := func(ctx context.Context, userID string) (string, string, error) {
		return "founder@dynolabs.io", "founder-vanity", nil
	}

	tests := []struct {
		name string
		h    *Handlers
		out  Result
		uID  string
		mail string
		want bool
	}{
		{
			name: "happy path: apollo empty + linkedin on + lookup set + auth + email",
			h:    &Handlers{LinkedIn: enabledClient, UserLookup: lookup},
			out:  Result{},
			uID:  "u1",
			mail: "founder@dynolabs.io",
			want: true,
		},
		{
			name: "skip when apollo already filled both",
			h:    &Handlers{LinkedIn: enabledClient, UserLookup: lookup},
			out:  Result{Title: "CEO", Company: "Foo"},
			uID:  "u1",
			mail: "founder@dynolabs.io",
			want: false,
		},
		{
			name: "trigger when title only is filled (company missing)",
			h:    &Handlers{LinkedIn: enabledClient, UserLookup: lookup},
			out:  Result{Title: "CEO"},
			uID:  "u1",
			mail: "founder@dynolabs.io",
			want: true,
		},
		{
			name: "skip when linkedin client disabled",
			h:    &Handlers{LinkedIn: disabledClient, UserLookup: lookup},
			out:  Result{},
			uID:  "u1",
			mail: "founder@dynolabs.io",
			want: false,
		},
		{
			name: "skip when UserLookup not configured",
			h:    &Handlers{LinkedIn: enabledClient, UserLookup: nil},
			out:  Result{},
			uID:  "u1",
			mail: "founder@dynolabs.io",
			want: false,
		},
		{
			name: "skip when no authed user",
			h:    &Handlers{LinkedIn: enabledClient, UserLookup: lookup},
			out:  Result{},
			uID:  "",
			mail: "founder@dynolabs.io",
			want: false,
		},
		{
			name: "skip when email is empty/whitespace",
			h:    &Handlers{LinkedIn: enabledClient, UserLookup: lookup},
			out:  Result{},
			uID:  "u1",
			mail: "   ",
			want: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.h.shouldChainLinkedIn(tt.out, tt.uID, tt.mail); got != tt.want {
				t.Errorf("shouldChainLinkedIn = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestVanityForSelf(t *testing.T) {
	mkLookup := func(email, vanity string, err error) func(context.Context, string) (string, string, error) {
		return func(ctx context.Context, _ string) (string, string, error) {
			return email, vanity, err
		}
	}
	tests := []struct {
		name     string
		lookup   func(context.Context, string) (string, string, error)
		reqEmail string
		want     string
	}{
		{
			name:     "match → vanity",
			lookup:   mkLookup("founder@dynolabs.io", "founder-handle", nil),
			reqEmail: "founder@dynolabs.io",
			want:     "founder-handle",
		},
		{
			name:     "case-insensitive match",
			lookup:   mkLookup("Founder@Dynolabs.IO", "founder-handle", nil),
			reqEmail: "founder@dynolabs.io",
			want:     "founder-handle",
		},
		{
			name:     "trim spaces on both sides",
			lookup:   mkLookup("  founder@dynolabs.io  ", "founder-handle", nil),
			reqEmail: "founder@dynolabs.io   ",
			want:     "founder-handle",
		},
		{
			name:     "different email → empty (privacy guard)",
			lookup:   mkLookup("founder@dynolabs.io", "founder-handle", nil),
			reqEmail: "someone-else@example.com",
			want:     "",
		},
		{
			name:     "no vanity stored → empty",
			lookup:   mkLookup("founder@dynolabs.io", "", nil),
			reqEmail: "founder@dynolabs.io",
			want:     "",
		},
		{
			name:     "user has no email → empty",
			lookup:   mkLookup("", "founder-handle", nil),
			reqEmail: "founder@dynolabs.io",
			want:     "",
		},
		{
			name:     "lookup error → empty",
			lookup:   mkLookup("founder@dynolabs.io", "founder-handle", errors.New("db down")),
			reqEmail: "founder@dynolabs.io",
			want:     "",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h := &Handlers{UserLookup: tt.lookup}
			if got := h.vanityForSelf(context.Background(), "u1", tt.reqEmail); got != tt.want {
				t.Errorf("vanityForSelf = %q, want %q", got, tt.want)
			}
		})
	}
}
