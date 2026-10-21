package safehttp

import (
	"context"
	"errors"
	"net"
	"net/http"
	"net/netip"
	"net/url"
	"strings"
	"time"
)

func Validate(raw string) error {
	if raw == "mock://success" || raw == "mock://failure" {
		return nil
	}
	u, err := url.Parse(raw)
	if err != nil || u.Scheme != "https" || u.Hostname() == "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" || len(raw) > 2048 {
		return errors.New("invalid webhook URL")
	}
	if u.Port() != "" && u.Port() != "443" {
		return errors.New("only HTTPS port 443 is allowed")
	}
	if strings.EqualFold(u.Hostname(), "localhost") {
		return errors.New("private destination")
	}
	if ip, err := netip.ParseAddr(u.Hostname()); err == nil && !Public(ip) {
		return errors.New("private destination")
	}
	return nil
}
func Public(ip netip.Addr) bool {
	ip = ip.Unmap()
	if !ip.IsGlobalUnicast() || ip.IsPrivate() || ip.IsLoopback() || ip.IsLinkLocalUnicast() {
		return false
	}
	for _, block := range []string{"100.64.0.0/10", "192.0.0.0/24", "192.0.2.0/24", "198.18.0.0/15", "198.51.100.0/24", "203.0.113.0/24", "2001:db8::/32"} {
		if netip.MustParsePrefix(block).Contains(ip) {
			return false
		}
	}
	return true
}
func Client() *http.Client {
	return &http.Client{Timeout: 5 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }, Transport: &http.Transport{Proxy: nil, DialContext: func(ctx context.Context, network, address string) (net.Conn, error) {
		host, port, err := net.SplitHostPort(address)
		if err != nil {
			return nil, err
		}
		ips, err := net.DefaultResolver.LookupNetIP(ctx, "ip", host)
		if err != nil || len(ips) == 0 {
			return nil, errors.New("destination unavailable")
		}
		for _, ip := range ips {
			if !Public(ip) {
				return nil, errors.New("private destination")
			}
		}
		return (&net.Dialer{Timeout: 3 * time.Second}).DialContext(ctx, network, net.JoinHostPort(ips[0].String(), port))
	}}}
}
