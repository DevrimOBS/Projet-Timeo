FROM golang:1.22-alpine

WORKDIR /app

# Install Trivy using the official installer so the agent can invoke it.
# Keep runtime dependencies minimal (ca-certificates, curl) required by the installer.
RUN apk add --no-cache ca-certificates curl \
    && curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin

COPY go.mod ./
COPY src ./src
RUN go build -o /usr/local/bin/novisec-agent ./src

# Create a non-root user but add it to the root group so it can access
# the Docker socket when the socket is owned by root:root with group
# permissions (typical on some hosts). This keeps the process UID non-root
# while allowing group access to the socket.
RUN adduser -D -u 1001 -G root appuser \
	&& chown appuser:root /usr/local/bin/novisec-agent \
	&& chmod +x /usr/local/bin/trivy || true

USER appuser
ENTRYPOINT ["/usr/local/bin/novisec-agent"]
