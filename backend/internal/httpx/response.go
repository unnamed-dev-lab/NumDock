package httpx

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5/middleware"
)

type Error struct {
	Code      string `json:"code"`
	Message   string `json:"message"`
	RequestID string `json:"request_id"`
}

func JSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func Fail(w http.ResponseWriter, r *http.Request, status int, code, message string) {
	JSON(w, status, Error{Code: code, Message: message, RequestID: middleware.GetReqID(r.Context())})
}
