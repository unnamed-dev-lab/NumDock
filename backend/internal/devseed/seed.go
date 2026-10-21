// Package devseed provisions explicit development fixtures, never live resources.
package devseed

import (
	"context"
	"errors"
	"fmt"
	"github.com/jackc/pgx/v5/pgtype"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	seeddb "numdock/backend/internal/devseed/db"
	"numdock/backend/internal/identity"
)

const WorkspaceID = "d0000000-0000-4000-8000-000000000001"
const IsolatedWorkspaceID = "d0000000-0000-4000-8000-000000000002"

type account struct{ id, email, name, organization, role string }

var accounts = []account{
	{"d1000000-0000-4000-8000-000000000001", "owner@numdock.test", "Development Owner", WorkspaceID, "owner"},
	{"d1000000-0000-4000-8000-000000000002", "admin@numdock.test", "Development Admin", WorkspaceID, "admin"},
	{"d1000000-0000-4000-8000-000000000003", "member@numdock.test", "Development Member", WorkspaceID, "member"},
	{"d1000000-0000-4000-8000-000000000004", "isolated@numdock.test", "Isolated Owner", IsolatedWorkspaceID, "owner"},
}

// Run is atomic, serialized across processes, and does not reset passwords,
// memberships or edited fixtures on reruns. It creates no authenticated sessions.
func Run(ctx context.Context, pool *pgxpool.Pool, environment, password string) error {
	if environment != "development" {
		return errors.New("seed requires APP_ENV=development")
	}
	if err := identity.ValidatePassword(password); err != nil {
		return errors.New("DEV_SEED_PASSWORD must contain 12–128 characters")
	}
	tx, err := pool.Begin(ctx)
	if err != nil {
		return errors.New("seed could not start transaction")
	}
	defer tx.Rollback(ctx)
	q := seeddb.New(tx)
	if err := q.SeedLock(ctx); err != nil {
		return errors.New("seed could not acquire lock")
	}
	for _, org := range []struct{ id, name string }{{WorkspaceID, "NumDock Development (Mock)"}, {IsolatedWorkspaceID, "Isolated Development (Mock)"}} {
		if err := q.SeedOrganization(ctx, seeddb.SeedOrganizationParams{ID: org.id, Name: org.name}); err != nil {
			return errors.New("seed organization failed")
		}
	}
	for _, a := range accounts {
		hash, err := identity.HashPassword(password)
		if err != nil {
			return errors.New("seed password hashing failed")
		}
		if err := q.SeedUser(ctx, seeddb.SeedUserParams{ID: a.id, Email: a.email, Name: a.name, PasswordHash: hash}); err != nil {
			return errors.New("seed account conflicts with existing data; no changes committed")
		}
		valid, err := q.VerifySeedUser(ctx, seeddb.VerifySeedUserParams{ID: a.id, Email: a.email})
		if err != nil || !valid {
			return errors.New("seed account ID conflicts with existing data; no changes committed")
		}
		if err := q.SeedMembership(ctx, seeddb.SeedMembershipParams{UserID: a.id, OrganizationID: a.organization, Role: a.role}); err != nil {
			return errors.New("seed membership failed")
		}
	}
	// Synthetic NANP 555-01xx demonstration numbers. No upstream provider calls.
	for i := 0; i < 24; i++ {
		country, name, region, prefix := "US", "United States", "San Francisco (Mock)", "+141555501"
		if i >= 12 {
			country, name, region, prefix = "CA", "Canada", "Toronto (Mock)", "+141655501"
		}
		kind, capabilities := "local", []string{"sms", "voice"}
		if i%3 == 0 {
			kind, capabilities = "mobile", []string{"sms", "mms"}
		}
		if i%3 == 1 {
			capabilities = []string{"voice"}
		}
		err := q.SeedCatalogItem(ctx, seeddb.SeedCatalogItemParams{ID: fmt.Sprintf("d2000000-0000-4000-8000-%012d", i+1), E164: fmt.Sprintf("%s%02d", prefix, i), CountryCode: country, CountryName: name, Region: region, NumberType: kind, Capabilities: capabilities, MonthlyFeeMinor: int32(200 + i*25), InboundSmsFeeMicros: int32(7500 + i*100)})
		if err != nil {
			return errors.New("seed catalog conflicts with existing data; no changes committed")
		}
	}
	// Rolling 30-day, organization-isolated dashboard samples, never real transactions.
	today := time.Now().UTC().Truncate(24 * time.Hour)
	for _, org := range []struct {
		id    string
		scale int32
	}{{WorkspaceID, 4}, {IsolatedWorkspaceID, 1}} {
		for offset := 29; offset >= 0; offset-- {
			date := today.AddDate(0, 0, -offset)
			dayIndex := int32(date.Unix() / 86400)
			received := (120 + (dayIndex%17)*13 + (dayIndex%5)*21) * org.scale
			failed := (dayIndex%7 + 1) * org.scale
			if dayIndex%11 == 0 {
				failed += 22 * org.scale
			}
			err := q.SeedOverviewDay(ctx, seeddb.SeedOverviewDayParams{OrganizationID: org.id, Day: pgtype.Date{Time: date, Valid: true}, ActiveNumbers: (4 + dayIndex%3) * org.scale, MessagesReceived: received, MessagesFailed: failed, OrdersCompleted: (1 + dayIndex%4) * org.scale, SpendMinor: received*2 + 150*org.scale})
			if err != nil {
				return errors.New("seed overview failed; no changes committed")
			}
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return errors.New("seed commit failed")
	}
	return nil
}
