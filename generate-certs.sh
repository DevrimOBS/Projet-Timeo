#!/bin/bash
# Generate self-signed certificates for TLS/HTTPS

CERT_DIR="./certs"
DAYS=365

# Create certs directory if it doesn't exist
mkdir -p "$CERT_DIR"

echo "Generating self-signed TLS certificates..."

# Generate private key
openssl genrsa -out "$CERT_DIR/server.key" 2048

# Generate certificate signing request
openssl req -new \
  -key "$CERT_DIR/server.key" \
  -out "$CERT_DIR/server.csr" \
  -subj "/C=FR/ST=IDF/L=Paris/O=NoviSec/CN=localhost"

# Generate self-signed certificate
openssl x509 -req -days "$DAYS" \
  -in "$CERT_DIR/server.csr" \
  -signkey "$CERT_DIR/server.key" \
  -out "$CERT_DIR/server.crt" \
  -extfile <(printf "subjectAltName=DNS:localhost,DNS:*.novisec.local,IP:127.0.0.1")

# Create PKCS12 format for Java/Node (optional)
openssl pkcs12 -export -in "$CERT_DIR/server.crt" \
  -inkey "$CERT_DIR/server.key" \
  -out "$CERT_DIR/server.p12" \
  -name novisec-server \
  -passout pass:novisec-secure-pass

# Display info
echo ""
echo "✅ Certificates generated in $CERT_DIR:"
echo "  - server.key   (private key)"
echo "  - server.crt   (certificate)"
echo "  - server.p12   (PKCS12 format)"
echo ""
echo "Valid for $DAYS days"
echo ""
echo "To use in production, replace with real certificates from a CA."
