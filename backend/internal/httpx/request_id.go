package httpx

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"sync/atomic"
	"time"
)

type requestIDKey struct{}

var requestIDFallback atomic.Uint64

// NewRequestID returns an unguessable, server-generated request identifier.
// It deliberately does not use any client-supplied header or the host name.
func NewRequestID() string {
	var raw [16]byte
	if _, err := rand.Read(raw[:]); err == nil {
		return base64.RawURLEncoding.EncodeToString(raw[:])
	}
	// crypto/rand failure is effectively unrecoverable, but request handling
	// should not stop. The fallback still provides a unique correlation value.
	return fmt.Sprintf("fallback-%d-%d", time.Now().UnixNano(), requestIDFallback.Add(1))
}

func WithRequestID(ctx context.Context, id string) context.Context {
	return context.WithValue(ctx, requestIDKey{}, id)
}

func RequestID(ctx context.Context) string {
	if ctx == nil {
		return ""
	}
	id, _ := ctx.Value(requestIDKey{}).(string)
	return id
}
