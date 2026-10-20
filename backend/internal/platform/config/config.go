package config

import (
	"errors"
	"net/url"
	"os"
)

type Config struct {
	DatabaseURL   string
	Address       string
	AppOrigin     string
	SecureCookies bool
}

func Load() (Config, error) {
	c := Config{DatabaseURL: os.Getenv("DATABASE_URL"), Address: os.Getenv("HTTP_ADDR"), AppOrigin: os.Getenv("APP_ORIGIN"), SecureCookies: os.Getenv("COOKIE_SECURE") != "false"}
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
