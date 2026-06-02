#!/bin/bash
set -euo pipefail

# Generate a local CA and a server certificate for TLS/HTTPS.

CERT_DIR="${1:-./certs}"
DAYS="${DAYS:-365}"
PFX_PASSWORD="${PFX_PASSWORD:-novisec-secure-pass}"

mkdir -p "$CERT_DIR"

echo "Generating local TLS certificates in $CERT_DIR..."

openssl genrsa -out "$CERT_DIR/ca.key" 4096
openssl req -x509 -new -nodes \
  -key "$CERT_DIR/ca.key" \
  -sha256 \
  -days "$DAYS" \
  -out "$CERT_DIR/ca.crt" \
  -subj "/C=FR/ST=IDF/L=Paris/O=NoviSec/CN=NoviSec Local CA"

openssl genrsa -out "$CERT_DIR/server.key" 2048
openssl req -new \
  -key "$CERT_DIR/server.key" \
  -out "$CERT_DIR/server.csr" \
  -subj "/C=FR/ST=IDF/L=Paris/O=NoviSec/CN=api"

cat > "$CERT_DIR/server.ext" <<EOF
authorityKeyIdentifier=keyid,issuer
basicConstraints=CA:FALSE
keyUsage=digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
subjectAltName=DNS:api,DNS:localhost,DNS:*.novisec.local,IP:127.0.0.1
EOF

openssl x509 -req \
  -in "$CERT_DIR/server.csr" \
  -CA "$CERT_DIR/ca.crt" \
  -CAkey "$CERT_DIR/ca.key" \
  -CAcreateserial \
  -days "$DAYS" \
  -sha256 \
  -extfile "$CERT_DIR/server.ext" \
  -out "$CERT_DIR/server.crt"

openssl pkcs12 -export \
  -in "$CERT_DIR/server.crt" \
  -inkey "$CERT_DIR/server.key" \
  -certfile "$CERT_DIR/ca.crt" \
  -out "$CERT_DIR/server.pfx" \
  -name novisec-server \
  -passout pass:"$PFX_PASSWORD"

rm -f "$CERT_DIR/server.csr" "$CERT_DIR/server.ext" "$CERT_DIR/ca.srl"
chmod 640 "$CERT_DIR"/*.key "$CERT_DIR"/*.crt "$CERT_DIR"/server.pfx

echo ""
echo "Certificates generated:"
echo "  - $CERT_DIR/ca.crt"
echo "  - $CERT_DIR/ca.key"
echo "  - $CERT_DIR/server.crt"
echo "  - $CERT_DIR/server.key"
echo "  - $CERT_DIR/server.pfx"
echo ""
echo "The server certificate is valid for localhost, 127.0.0.1, api, and *.novisec.local."
