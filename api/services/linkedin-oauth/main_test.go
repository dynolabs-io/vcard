package main

import "testing"

func TestDeriveVanity(t *testing.T) {
	tests := []struct {
		name, vanityName, profileURL, want string
	}{
		{"direct claim wins", "satyanadella", "https://www.linkedin.com/in/someoneelse", "satyanadella"},
		{"trim direct claim", "  satyanadella  ", "", "satyanadella"},
		{"parse fully-qualified URL", "", "https://www.linkedin.com/in/satyanadella", "satyanadella"},
		{"parse with trailing slash", "", "https://www.linkedin.com/in/satyanadella/", "satyanadella"},
		{"parse with query string", "", "https://www.linkedin.com/in/satyanadella?utm=foo", "satyanadella"},
		{"parse with fragment", "", "https://www.linkedin.com/in/satyanadella#about", "satyanadella"},
		{"parse path-only", "", "/in/satyanadella", "satyanadella"},
		{"parse without scheme", "", "linkedin.com/in/satyanadella", "satyanadella"},
		{"dashes + digits allowed", "", "https://www.linkedin.com/in/jane-doe-12345", "jane-doe-12345"},
		{"unicode handle", "", "https://www.linkedin.com/in/sätoshi-中", "sätoshi-中"},
		{"empty when neither set", "", "", ""},
		{"empty when URL has no /in/", "", "https://www.linkedin.com/feed/", ""},
		{"empty on whitespace-only inputs", "   ", "   ", ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := deriveVanity(tt.vanityName, tt.profileURL); got != tt.want {
				t.Errorf("deriveVanity(%q, %q) = %q, want %q", tt.vanityName, tt.profileURL, got, tt.want)
			}
		})
	}
}

func TestVanitySource(t *testing.T) {
	cases := map[[2]string]string{
		{"satya", ""}:                                 "vanityName",
		{"", "https://www.linkedin.com/in/x"}:         "profileURL",
		{"", ""}:                                      "none",
		{"  ", "   "}:                                 "none",
		{"satya", "https://www.linkedin.com/in/other"}: "vanityName",
	}
	for in, want := range cases {
		if got := vanitySource(in[0], in[1]); got != want {
			t.Errorf("vanitySource(%q, %q) = %q, want %q", in[0], in[1], got, want)
		}
	}
}
