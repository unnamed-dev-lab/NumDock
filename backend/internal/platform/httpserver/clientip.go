package httpserver

import (
	"fmt"
	"net"
	"net/http"
	"strings"
)

// ClientIPResolver determines the client address used for rate limiting.
// X-Forwarded-For is only considered when the immediate peer is explicitly
// listed as a trusted proxy.
type ClientIPResolver struct {
	trusted []*net.IPNet
}

func NewClientIPResolver(entries []string) (*ClientIPResolver, error) {
	resolver := &ClientIPResolver{}
	for _, entry := range entries {
		entry = strings.TrimSpace(entry)
		if entry == "" {
			continue
		}
		if strings.Contains(entry, "/") {
			_, network, err := net.ParseCIDR(entry)
			if err != nil {
				return nil, fmt.Errorf("invalid trusted proxy CIDR %q", entry)
			}
			resolver.trusted = append(resolver.trusted, network)
			continue
		}
		ip := net.ParseIP(entry)
		if ip == nil {
			return nil, fmt.Errorf("invalid trusted proxy address %q", entry)
		}
		if v4 := ip.To4(); v4 != nil {
			resolver.trusted = append(resolver.trusted, &net.IPNet{IP: v4, Mask: net.CIDRMask(32, 32)})
			continue
		}
		resolver.trusted = append(resolver.trusted, &net.IPNet{IP: ip, Mask: net.CIDRMask(128, 128)})
	}
	return resolver, nil
}

func (r *ClientIPResolver) ClientIP(req *http.Request) string {
	peer := parseIP(remoteHost(req.RemoteAddr))
	if peer == nil {
		return remoteHost(req.RemoteAddr)
	}
	if r == nil || len(r.trusted) == 0 || !r.trustedIP(peer) {
		return peer.String()
	}

	values := req.Header.Values("X-Forwarded-For")
	if len(values) == 0 {
		return peer.String()
	}
	tokens := strings.Split(strings.Join(values, ","), ",")
	client := peer
	for i := len(tokens) - 1; i >= 0; i-- {
		candidate := parseIP(tokens[i])
		if candidate == nil {
			// Stop at the first malformed hop. Walking further left would let a
			// caller smuggle an address past an otherwise trusted proxy chain.
			break
		}
		client = candidate
		if !r.trustedIP(candidate) {
			return candidate.String()
		}
	}
	return client.String()
}

func (r *ClientIPResolver) trustedIP(ip net.IP) bool {
	if r == nil {
		return false
	}
	for _, network := range r.trusted {
		if network.Contains(ip) {
			return true
		}
	}
	return false
}

func remoteHost(remoteAddr string) string {
	host, _, err := net.SplitHostPort(strings.TrimSpace(remoteAddr))
	if err == nil {
		return host
	}
	return strings.Trim(strings.TrimSpace(remoteAddr), "[]")
}

func parseIP(value string) net.IP {
	value = strings.TrimSpace(value)
	if host, _, err := net.SplitHostPort(value); err == nil {
		value = host
	}
	value = strings.Trim(value, "[]")
	if zone := strings.LastIndexByte(value, '%'); zone >= 0 {
		value = value[:zone]
	}
	ip := net.ParseIP(value)
	if ip == nil {
		return nil
	}
	if v4 := ip.To4(); v4 != nil {
		return v4
	}
	return ip
}
