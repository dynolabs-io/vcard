// Package users — minimal user store keyed by Apple's stable sub claim.
// We store the user's name and email (could be the relay address) for
// display only; the source of truth for identity is always Apple.
package users

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
)

var ErrNotFound = errors.New("user not found")

type User struct {
	ID             string `json:"id"`
	AppleSub       string `json:"-"` // never returned to clients
	LinkedInSub    string `json:"-"` // never returned to clients
	Name           string `json:"name,omitempty"`
	Email          string `json:"email,omitempty"`
	PhotoURL       string `json:"photoUrl,omitempty"`
	LinkedInVanity string `json:"linkedinVanity,omitempty"`
}

type Repo struct{ db *sql.DB }

func NewRepo(db *sql.DB) *Repo { return &Repo{db: db} }

// Upsert returns an existing user with the matching apple_sub or creates
// one. The (optional) name/email are filled on first sight; subsequent
// SIWA flows only return them if Apple shipped them in the token (Apple
// strips name/email after the first sign-in).
func (r *Repo) Upsert(ctx context.Context, appleSub, name, email string) (*User, error) {
	// Try the fast path — already exists.
	const selQ = `SELECT id, COALESCE(name, ''), COALESCE(email, '') FROM users WHERE apple_sub = $1`
	var u User
	u.AppleSub = appleSub
	if err := r.db.QueryRowContext(ctx, selQ, appleSub).Scan(&u.ID, &u.Name, &u.Email); err == nil {
		// If the prior insert went through without name/email but Apple
		// shipped them now (rare — happens if the user revokes + re-grants),
		// patch the row.
		if (u.Name == "" && name != "") || (u.Email == "" && email != "") {
			_, _ = r.db.ExecContext(ctx,
				`UPDATE users SET name = COALESCE(NULLIF($1, ''), name), email = COALESCE(NULLIF($2, ''), email) WHERE id = $3`,
				name, email, u.ID)
			if name != "" {
				u.Name = name
			}
			if email != "" {
				u.Email = email
			}
		}
		return &u, nil
	} else if !errors.Is(err, sql.ErrNoRows) {
		return nil, fmt.Errorf("user select: %w", err)
	}

	// Insert path.
	const insQ = `
		INSERT INTO users (apple_sub, name, email)
		VALUES ($1, NULLIF($2, ''), NULLIF($3, ''))
		ON CONFLICT (apple_sub) DO UPDATE SET name = COALESCE(users.name, EXCLUDED.name), email = COALESCE(users.email, EXCLUDED.email)
		RETURNING id, COALESCE(name, ''), COALESCE(email, '')`
	if err := r.db.QueryRowContext(ctx, insQ, appleSub, name, email).Scan(&u.ID, &u.Name, &u.Email); err != nil {
		return nil, fmt.Errorf("user upsert: %w", err)
	}
	return &u, nil
}

// GetByID returns a single user by primary key.
func (r *Repo) GetByID(ctx context.Context, id string) (*User, error) {
	const q = `SELECT id, COALESCE(apple_sub, ''), COALESCE(linkedin_sub, ''), COALESCE(name, ''), COALESCE(email, ''), COALESCE(photo_url, ''), COALESCE(linkedin_vanity, '') FROM users WHERE id = $1`
	var u User
	if err := r.db.QueryRowContext(ctx, q, id).Scan(&u.ID, &u.AppleSub, &u.LinkedInSub, &u.Name, &u.Email, &u.PhotoURL, &u.LinkedInVanity); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("user get: %w", err)
	}
	return &u, nil
}

// UpsertLinkedIn — find or create a user keyed by LinkedIn's sub claim.
// Blank fields are left untouched on update so we never overwrite a
// previously-captured value with an empty one (relevant because LinkedIn
// ships `vanityName` only for some apps' OIDC scopes — a later sign-in
// without it must not erase what we already stored).
func (r *Repo) UpsertLinkedIn(ctx context.Context, linkedInSub, name, email, photoURL, vanity string) (*User, error) {
	const selQ = `SELECT id, COALESCE(name, ''), COALESCE(email, ''), COALESCE(photo_url, ''), COALESCE(linkedin_vanity, '') FROM users WHERE linkedin_sub = $1`
	var u User
	u.LinkedInSub = linkedInSub
	if err := r.db.QueryRowContext(ctx, selQ, linkedInSub).Scan(&u.ID, &u.Name, &u.Email, &u.PhotoURL, &u.LinkedInVanity); err == nil {
		if (u.Name == "" && name != "") || (u.Email == "" && email != "") || (u.PhotoURL == "" && photoURL != "") || (u.LinkedInVanity == "" && vanity != "") {
			_, _ = r.db.ExecContext(ctx,
				`UPDATE users SET
				    name            = COALESCE(NULLIF($1, ''), name),
				    email           = COALESCE(NULLIF($2, ''), email),
				    photo_url       = COALESCE(NULLIF($3, ''), photo_url),
				    linkedin_vanity = COALESCE(NULLIF($4, ''), linkedin_vanity)
				 WHERE id = $5`,
				name, email, photoURL, vanity, u.ID)
			if name != "" {
				u.Name = name
			}
			if email != "" {
				u.Email = email
			}
			if photoURL != "" {
				u.PhotoURL = photoURL
			}
			if vanity != "" {
				u.LinkedInVanity = vanity
			}
		}
		return &u, nil
	} else if !errors.Is(err, sql.ErrNoRows) {
		return nil, fmt.Errorf("user select: %w", err)
	}

	const insQ = `
		INSERT INTO users (linkedin_sub, name, email, photo_url, linkedin_vanity)
		VALUES ($1, NULLIF($2, ''), NULLIF($3, ''), NULLIF($4, ''), NULLIF($5, ''))
		RETURNING id, COALESCE(name, ''), COALESCE(email, ''), COALESCE(photo_url, ''), COALESCE(linkedin_vanity, '')`
	if err := r.db.QueryRowContext(ctx, insQ, linkedInSub, name, email, photoURL, vanity).Scan(&u.ID, &u.Name, &u.Email, &u.PhotoURL, &u.LinkedInVanity); err != nil {
		return nil, fmt.Errorf("user upsert linkedin: %w", err)
	}
	return &u, nil
}
