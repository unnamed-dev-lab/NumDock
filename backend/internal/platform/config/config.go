package config

import (
	"errors"
	"net/url"
	"os"
	"strings"
)

type Config struct {
	Environment    string
	DatabaseURL    string
	Address        string
	AppOrigin      string
	SecureCookies  bool
	TrustedProxies []string
}

func Load() (Config, error) {
	c := Config{
		Environment:    os.Getenv("APP_ENV"),
		DatabaseURL:    os.Getenv("DATABASE_URL"),
		Address:        os.Getenv("HTTP_ADDR"),
		AppOrigin:      os.Getenv("APP_ORIGIN"),
		SecureCookies:  os.Getenv("COOKIE_SECURE") != "false",
		TrustedProxies: splitList(os.Getenv("TRUSTED_PROXIES")),
	}
	if c.Environment == "" {
		c.Environment = "production"
	}
	if c.Environment != "production" && c.Environment != "development" && c.Environment != "test" {
		return c, errors.New("APP_ENV must be production, development, or test")
	}
	if c.Address == "" {
		c.Address = "127.0.0.1:8080"
	}
	if c.AppOrigin == "" {
		c.AppOrigin = "http://localhost:3000"
	}
	if c.DatabaseURL == "" {
		return c, errors.New("DATABASE_URL is required")
	}
	origin, err := url.Parse(c.AppOrigin)
	if err != nil || origin.Host == "" || (origin.Scheme != "http" && origin.Scheme != "https") || origin.Path != "" || origin.RawQuery != "" || origin.Fragment != "" || origin.User != nil {
		return c, errors.New("APP_ORIGIN must be an http(s) origin without a path")
	}
	local := origin.Hostname() == "localhost" || origin.Hostname() == "127.0.0.1" || origin.Hostname() == "::1"
	if !local && (origin.Scheme != "https" || !c.SecureCookies) {
		return c, errors.New("non-local deployments require HTTPS and secure cookies")
	}
	return c, nil
}

func splitList(value string) []string {
	var result []string
	for _, item := range strings.Split(value, ",") {
		item = strings.TrimSpace(item)
		if item != "" {
			result = append(result, item)
		}
	}
	return result
}
