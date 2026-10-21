package providers

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
)

type Mock struct{}

// Provision is deterministic and idempotent by order ID. It never contacts a carrier.
func (Mock) Provision(ctx context.Context, orderID string, simulateFailure bool) (string, error) {
	if err := ctx.Err(); err != nil {
		return "", err
	}
	if simulateFailure {
		return "", errors.New("mock provider unavailable")
	}
	digest := sha256.Sum256([]byte("numdock/mock/" + orderID))
	return "mock_" + hex.EncodeToString(digest[:]), nil
}
