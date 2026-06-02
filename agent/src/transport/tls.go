package transport

import (
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"
)

func newHTTPClient(endpoint string, timeout time.Duration, insecureSkipTLSVerify bool, caCertFile string) (*http.Client, error) {
	client := &http.Client{Timeout: timeout}
	if !strings.HasPrefix(strings.TrimSpace(endpoint), "https://") {
		return client, nil
	}

	tlsConfig := &tls.Config{MinVersion: tls.VersionTLS13}
	if insecureSkipTLSVerify {
		tlsConfig.InsecureSkipVerify = true
	} else if strings.TrimSpace(caCertFile) != "" {
		caCert, err := os.ReadFile(caCertFile)
		if err != nil {
			return nil, fmt.Errorf("read API CA certificate: %w", err)
		}

		rootCAs, err := x509.SystemCertPool()
		if err != nil || rootCAs == nil {
			rootCAs = x509.NewCertPool()
		}
		if ok := rootCAs.AppendCertsFromPEM(caCert); !ok {
			return nil, fmt.Errorf("append API CA certificate: no PEM certificates found in %s", caCertFile)
		}
		tlsConfig.RootCAs = rootCAs
	}

	client.Transport = &http.Transport{TLSClientConfig: tlsConfig}
	return client, nil
}
