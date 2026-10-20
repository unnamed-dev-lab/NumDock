package openapi

import _ "embed"

// Spec is the compiled OpenAPI contract served at /v1/openapi.yaml.
//
//go:embed openapi.yaml
var Spec []byte
