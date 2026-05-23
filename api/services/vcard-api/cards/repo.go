package cards

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"
)

var ErrNotFound = errors.New("card not found")

type Repo struct {
	db *sql.DB
}

func NewRepo(db *sql.DB) *Repo { return &Repo{db: db} }

// genSlug returns a URL-safe 8-char slug from [a-z2-9]. Avoids look-alike
// chars (0/o, 1/l) for verbal sharing. ~10^11 keyspace is plenty for v1.
func genSlug() string {
	const alphabet = "abcdefghjkmnpqrstuvwxyz23456789"
	var b [8]byte
	_, _ = rand.Read(b[:])
	out := make([]byte, 8)
	for i, x := range b {
		out[i] = alphabet[int(x)%len(alphabet)]
	}
	return string(out)
}

// Create inserts a new card. Caller may leave Slug empty; we generate one.
func (r *Repo) Create(ctx context.Context, c *Card) error {
	if c.Slug == "" {
		c.Slug = genSlug()
	}
	if c.Template == "" {
		c.Template = "mono"
	}
	if c.Label == "" {
		c.Label = "Work"
	}
	emails, _ := json.Marshal(orEmpty(c.Emails))
	phones, _ := json.Marshal(orEmpty(c.Phones))
	socials, _ := json.Marshal(orEmptySocials(c.Socials))

	const q = `
		INSERT INTO cards (slug, label, name, title, company, emails, phones, socials, photo_url, brand_logo_url, template, custom_color, wallet_style, device_id)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
		RETURNING id, created_at, updated_at`
	row := r.db.QueryRowContext(ctx, q,
		c.Slug, c.Label, c.Name, nullable(c.Title), nullable(c.Company),
		emails, phones, socials, nullable(c.PhotoURL), nullable(c.BrandLogoURL),
		c.Template, nullable(c.CustomColor), nullable(c.WalletStyle), nullable(c.DeviceID),
	)
	if err := row.Scan(&c.ID, &c.CreatedAt, &c.UpdatedAt); err != nil {
		return fmt.Errorf("insert card: %w", err)
	}
	return nil
}

func (r *Repo) GetByID(ctx context.Context, id string) (*Card, error) {
	const q = baseSelect + ` WHERE id = $1`
	return r.scanOne(ctx, q, id)
}

func (r *Repo) GetBySlug(ctx context.Context, slug string) (*Card, error) {
	const q = baseSelect + ` WHERE slug = $1`
	return r.scanOne(ctx, q, slug)
}

// ListByDeviceUnclaimed returns cards on the given device that have NOT
// yet been claimed by a user (user_id IS NULL). The anonymous list path
// uses this so that holding a leaked device_id cannot enumerate cards
// that have been attached to a user account. The signed-in union path
// also uses it to overlay device-local unclaimed cards on top of the
// user's claimed set without double-counting. See TBD-V13 (#23).
func (r *Repo) ListByDeviceUnclaimed(ctx context.Context, deviceID string) ([]Card, error) {
	const q = baseSelect + ` WHERE device_id = $1 AND user_id IS NULL ORDER BY created_at DESC`
	rows, err := r.db.QueryContext(ctx, q, deviceID)
	if err != nil {
		return nil, fmt.Errorf("list by device unclaimed: %w", err)
	}
	defer rows.Close()
	var out []Card
	for rows.Next() {
		c, err := scanCard(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *c)
	}
	return out, rows.Err()
}

// ListByUser returns all cards attached to the given user_id (regardless
// of which device created them). Used by the mobile app on launch when
// the user is signed in.
func (r *Repo) ListByUser(ctx context.Context, userID string) ([]Card, error) {
	const q = baseSelect + ` WHERE user_id = $1 ORDER BY created_at DESC`
	rows, err := r.db.QueryContext(ctx, q, userID)
	if err != nil {
		return nil, fmt.Errorf("list by user: %w", err)
	}
	defer rows.Close()
	var out []Card
	for rows.Next() {
		c, err := scanCard(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *c)
	}
	return out, rows.Err()
}

// SetUser attaches a single card to the given user_id (used at create
// time when the caller is signed in).
func (r *Repo) SetUser(ctx context.Context, cardID, userID string) error {
	_, err := r.db.ExecContext(ctx, `UPDATE cards SET user_id = $1 WHERE id = $2`, userID, cardID)
	if err != nil {
		return fmt.Errorf("set user: %w", err)
	}
	return nil
}

// AttachToUser sets user_id on every card currently attached to the
// given device_id but NOT yet owned by any user. This is the silent
// "claim" path at first sign-in. Returns the affected card IDs so the
// caller can re-fetch them with the new user_id projection.
func (r *Repo) AttachToUser(ctx context.Context, deviceID, userID string) ([]string, error) {
	rows, err := r.db.QueryContext(ctx,
		`UPDATE cards SET user_id = $1, updated_at = now()
		 WHERE device_id = $2 AND user_id IS NULL
		 RETURNING id`, userID, deviceID)
	if err != nil {
		return nil, fmt.Errorf("attach to user: %w", err)
	}
	defer rows.Close()
	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

// ResolveConflict applies one of three resolutions to a slug-collision
// between a local-only card and one already on the user's account.
//
//	"local"   → overwrite the server's card with the local payload.
//	"remote"  → discard the local (no-op on server, mobile drops its copy).
//	"both"    → re-slug the local card with a fresh slug and INSERT as a
//	             new server card owned by user_id.
func (r *Repo) ResolveConflict(ctx context.Context, userID, slug, winner string, local *Card) (*Card, error) {
	switch winner {
	case "remote":
		return r.GetBySlug(ctx, slug)
	case "local":
		// Server card stays at this slug; rewrite fields from local payload.
		existing, err := r.GetBySlug(ctx, slug)
		if err != nil {
			return nil, err
		}
		local.ID = existing.ID
		local.Slug = existing.Slug
		if err := r.Update(ctx, local); err != nil {
			return nil, err
		}
		return local, nil
	case "both":
		// Insert a fresh card with a new slug, owned by the user.
		local.Slug = ""
		local.ID = ""
		local.DeviceID = ""
		local.UserID = userID
		if err := r.Create(ctx, local); err != nil {
			return nil, err
		}
		// Attach user_id via UPDATE (Create doesn't take user_id from struct).
		if _, err := r.db.ExecContext(ctx, `UPDATE cards SET user_id = $1 WHERE id = $2`, userID, local.ID); err != nil {
			return nil, err
		}
		local.UserID = userID
		return local, nil
	default:
		return nil, fmt.Errorf("unknown conflict winner %q", winner)
	}
}

// Update is RETAINED for callers that legitimately want a full
// replace (claim/merge flows that have already loaded the full record).
// Mobile / external clients SHOULD use Patch instead — see TBD-V06.
func (r *Repo) Update(ctx context.Context, c *Card) error {
	emails, _ := json.Marshal(orEmpty(c.Emails))
	phones, _ := json.Marshal(orEmpty(c.Phones))
	socials, _ := json.Marshal(orEmptySocials(c.Socials))
	const q = `
		UPDATE cards SET label=$1, name=$2, title=$3, company=$4,
		  emails=$5, phones=$6, socials=$7, photo_url=$8, brand_logo_url=$9,
		  template=$10, custom_color=$11, wallet_style=$12, updated_at=now()
		WHERE id=$13 RETURNING updated_at`
	row := r.db.QueryRowContext(ctx, q,
		c.Label, c.Name, nullable(c.Title), nullable(c.Company),
		emails, phones, socials, nullable(c.PhotoURL), nullable(c.BrandLogoURL),
		c.Template, nullable(c.CustomColor), nullable(c.WalletStyle), c.ID)
	if err := row.Scan(&c.UpdatedAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrNotFound
		}
		return fmt.Errorf("update card: %w", err)
	}
	return nil
}

// patchColumnMap maps the JSON field name in the patch body to the DB
// column name. Only listed fields are patchable — IDs, slugs, timestamps,
// device_id, and user_id are server-managed and rejected at the boundary.
var patchColumnMap = map[string]string{
	"label":        "label",
	"name":         "name",
	"title":        "title",
	"company":      "company",
	"emails":       "emails",
	"phones":       "phones",
	"socials":      "socials",
	"photoUrl":     "photo_url",
	"brandLogoUrl": "brand_logo_url",
	"template":     "template",
	"customColor":  "custom_color",
	"walletStyle":  "wallet_style",
}

// Patch applies a partial update — ONLY fields present in `patch` are
// written. The map's keys must match patchColumnMap; unknown keys are
// silently ignored (server-managed fields like id/slug/createdAt are
// rejected this way). JSONB columns (emails/phones/socials) are passed
// through verbatim; scalar text columns use NULLIF so an empty string
// stored as NULL matches the schema's nullable semantics.
//
// Fix for TBD-V06: pre-2026-05-23 PATCH decoded into a Card{} zero-value
// and the repo wrote every column unconditionally, silently zeroing
// fields the caller didn't send. The mobile app's optimistic partial
// patches were a data-loss vector.
func (r *Repo) Patch(ctx context.Context, id string, patch map[string]json.RawMessage) (*Card, error) {
	if len(patch) == 0 {
		// Caller still gets a 200 — same row, no change.
		return r.GetByID(ctx, id)
	}
	setClauses := make([]string, 0, len(patch))
	args := make([]any, 0, len(patch)+1)
	i := 1
	for key, raw := range patch {
		col, ok := patchColumnMap[key]
		if !ok {
			continue // unknown / server-managed field — ignore
		}
		// JSONB arrays: pass through the raw bytes.
		if col == "emails" || col == "phones" || col == "socials" {
			setClauses = append(setClauses, fmt.Sprintf("%s = $%d", col, i))
			args = append(args, []byte(raw))
			i++
			continue
		}
		// Scalar text: a raw `null` is explicit-clear intent (TBD-V12).
		// We MUST handle it BEFORE the json.Unmarshal-into-string call
		// below — Go's json package returns an error when trying to
		// unmarshal null into a non-pointer string, which would otherwise
		// be misreported as "not a string" and return a 400 to the client
		// even though the caller's intent was clear.
		if string(raw) == "null" {
			setClauses = append(setClauses, fmt.Sprintf("%s = NULL", col))
			continue
		}
		var s string
		if err := json.Unmarshal(raw, &s); err != nil {
			return nil, fmt.Errorf("patch field %q: not a string: %w", key, err)
		}
		setClauses = append(setClauses, fmt.Sprintf("%s = NULLIF($%d, '')", col, i))
		args = append(args, s)
		i++
	}
	if len(setClauses) == 0 {
		// All keys were unknown — return the row unchanged.
		return r.GetByID(ctx, id)
	}
	setClauses = append(setClauses, "updated_at = now()")
	args = append(args, id)
	q := fmt.Sprintf("UPDATE cards SET %s WHERE id = $%d", strings.Join(setClauses, ", "), i)
	res, err := r.db.ExecContext(ctx, q, args...)
	if err != nil {
		return nil, fmt.Errorf("patch card: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return nil, ErrNotFound
	}
	return r.GetByID(ctx, id)
}

// ReachStats is the per-card analytics aggregation surface backing
// the mobile Inbox tab. Returns totals + per-day breakdown + UA-family
// distribution over the trailing `days` window (capped 1..90).
//
// All three result sets are bucketed by `kind` so the caller can render
// "profile views vs vCard downloads vs Wallet adopts" separately —
// these are different intent levels and conflating them in one number
// would understate Wallet adoption.
type ReachStats struct {
	Totals   map[string]int    `json:"totals"`   // kind → count
	ByDay    []ReachDayBucket  `json:"byDay"`    // newest first
	UAFamily map[string]int    `json:"uaFamily"` // family → count
}

// ReachDayBucket is one row of byDay.
type ReachDayBucket struct {
	Date    string `json:"date"`    // YYYY-MM-DD
	Profile int    `json:"profile"`
	VCF     int    `json:"vcf"`
	PKPass  int    `json:"pkpass"`
}

// ReachStatsBySlug returns the analytics aggregation. Three SELECTs —
// kept separate (instead of a CTE chain) so explain plans stay obvious
// and a slow group-by-date doesn't block the totals path. days clamped
// inside; pass 0 to use the default 30.
func (r *Repo) ReachStatsBySlug(ctx context.Context, slug string, days int) (*ReachStats, error) {
	if days <= 0 {
		days = 30
	}
	if days > 90 {
		days = 90
	}
	out := &ReachStats{
		Totals:   map[string]int{"profile": 0, "vcf": 0, "pkpass": 0},
		ByDay:    []ReachDayBucket{},
		UAFamily: map[string]int{},
	}

	// 1. Totals by kind
	rows, err := r.db.QueryContext(ctx,
		`SELECT kind, count(*)
		   FROM scan_events
		  WHERE target_slug = $1
		    AND occurred_at > now() - make_interval(days => $2::int)
		  GROUP BY kind`,
		slug, days)
	if err != nil {
		return nil, fmt.Errorf("reach totals: %w", err)
	}
	for rows.Next() {
		var k string
		var n int
		if err := rows.Scan(&k, &n); err != nil {
			rows.Close()
			return nil, err
		}
		out.Totals[k] = n
	}
	rows.Close()

	// 2. By-day breakdown — one row per (date, kind), then pivot to wide.
	rows, err = r.db.QueryContext(ctx,
		`SELECT to_char(date_trunc('day', occurred_at), 'YYYY-MM-DD') AS day,
		        kind, count(*)
		   FROM scan_events
		  WHERE target_slug = $1
		    AND occurred_at > now() - make_interval(days => $2::int)
		  GROUP BY day, kind
		  ORDER BY day DESC`,
		slug, days)
	if err != nil {
		return nil, fmt.Errorf("reach by-day: %w", err)
	}
	byDay := map[string]*ReachDayBucket{}
	for rows.Next() {
		var day, kind string
		var n int
		if err := rows.Scan(&day, &kind, &n); err != nil {
			rows.Close()
			return nil, err
		}
		b, ok := byDay[day]
		if !ok {
			b = &ReachDayBucket{Date: day}
			byDay[day] = b
		}
		switch kind {
		case "profile":
			b.Profile = n
		case "vcf":
			b.VCF = n
		case "pkpass":
			b.PKPass = n
		}
	}
	rows.Close()
	// Convert to slice in DESC date order. Sorting via the days input
	// (sorted DESC by the SQL); since maps are unordered, re-emit in
	// insertion order is unsafe — sort by Date DESC instead.
	for _, b := range byDay {
		out.ByDay = append(out.ByDay, *b)
	}
	// Reverse-lex sort by date (YYYY-MM-DD is lex-orderable).
	sort.Slice(out.ByDay, func(i, j int) bool { return out.ByDay[i].Date > out.ByDay[j].Date })

	// 3. UA family distribution (NULLs treated as "" — drop those)
	rows, err = r.db.QueryContext(ctx,
		`SELECT ua_family, count(*)
		   FROM scan_events
		  WHERE target_slug = $1
		    AND occurred_at > now() - make_interval(days => $2::int)
		    AND ua_family IS NOT NULL
		  GROUP BY ua_family`,
		slug, days)
	if err != nil {
		return nil, fmt.Errorf("reach ua-family: %w", err)
	}
	for rows.Next() {
		var f string
		var n int
		if err := rows.Scan(&f, &n); err != nil {
			rows.Close()
			return nil, err
		}
		out.UAFamily[f] = n
	}
	rows.Close()
	return out, nil
}

// RecordScanEvent appends a row to scan_events (anonymous fact table —
// see the migration in this package). Fire-and-forget from the calling
// handler: the row is "best effort" telemetry for Inbox reach analytics,
// never blocks the user-visible response. Fields:
//
//   - targetSlug: card whose surface was hit (REQUIRED, validated upstream)
//   - kind:       one of "profile" / "vcf" / "pkpass" (REQUIRED)
//   - city/country/uaFamily: optional resolved bucket — caller passes ""
//     when unknown. Schema columns are nullable; empty strings map to NULL.
//
// Per the migration's "No PII" promise, this method does NOT take a raw
// IP or User-Agent string — callers MUST pre-resolve to the low-cardinality
// bucket before calling here.
func (r *Repo) RecordScanEvent(ctx context.Context, targetSlug, kind, city, country, uaFamily string) error {
	const q = `INSERT INTO scan_events (target_slug, kind, city, country, ua_family)
	           VALUES ($1, $2, NULLIF($3, ''), NULLIF($4, ''), NULLIF($5, ''))`
	_, err := r.db.ExecContext(ctx, q, targetSlug, kind, city, country, uaFamily)
	if err != nil {
		return fmt.Errorf("scan_events insert: %w", err)
	}
	return nil
}

func (r *Repo) Delete(ctx context.Context, id string) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM cards WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("delete card: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

const baseSelect = `
	SELECT id, slug, label, name,
	       COALESCE(title, ''), COALESCE(company, ''),
	       emails, phones, socials,
	       COALESCE(photo_url, ''), COALESCE(brand_logo_url, ''),
	       template,
	       COALESCE(custom_color, ''), COALESCE(wallet_style, ''),
	       COALESCE(device_id, ''),
	       COALESCE(user_id::text, ''),
	       created_at, updated_at
	FROM cards`

type rowScanner interface {
	Scan(dest ...any) error
}

func (r *Repo) scanOne(ctx context.Context, q string, args ...any) (*Card, error) {
	row := r.db.QueryRowContext(ctx, q, args...)
	c, err := scanCard(row)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return c, nil
}

func scanCard(s rowScanner) (*Card, error) {
	var c Card
	var emailsRaw, phonesRaw, socialsRaw []byte
	if err := s.Scan(
		&c.ID, &c.Slug, &c.Label, &c.Name,
		&c.Title, &c.Company,
		&emailsRaw, &phonesRaw, &socialsRaw,
		&c.PhotoURL, &c.BrandLogoURL, &c.Template,
		&c.CustomColor, &c.WalletStyle, &c.DeviceID, &c.UserID,
		&c.CreatedAt, &c.UpdatedAt,
	); err != nil {
		return nil, err
	}
	_ = json.Unmarshal(emailsRaw, &c.Emails)
	_ = json.Unmarshal(phonesRaw, &c.Phones)
	_ = json.Unmarshal(socialsRaw, &c.Socials)
	if c.Emails == nil {
		c.Emails = []string{}
	}
	if c.Phones == nil {
		c.Phones = []string{}
	}
	if c.Socials == nil {
		c.Socials = []Social{}
	}
	return &c, nil
}

func nullable(s string) any {
	if s == "" {
		return nil
	}
	return s
}

func orEmpty[T any](s []T) []T {
	if s == nil {
		return []T{}
	}
	return s
}

func orEmptySocials(s []Social) []Social { return orEmpty(s) }
