FROM golang:1.22-alpine

WORKDIR /app
COPY go.mod ./
COPY src ./src
RUN go build -o /usr/local/bin/novisec-agent ./src

# Install Trivy (static binary) so the agent can run local DB updates and scans
RUN apk add --no-cache ca-certificates curl tar gzip \
	&& TRIVY_VER="0.44.1" \
	&& ARCH="$(apk --print-arch)" \
	&& case "$ARCH" in
			 x86_64) TRIVY_ARCH="x86_64" ;; \
			 aarch64) TRIVY_ARCH="aarch64" ;; \
			 *) TRIVY_ARCH="x86_64" ;; \
		 esac \
	&& curl -fsSL -o /tmp/trivy.tar.gz "https://github.com/aquasecurity/trivy/releases/download/v${TRIVY_VER}/trivy_${TRIVY_VER}_Linux-${TRIVY_ARCH}.tar.gz" \
	&& tar -xzf /tmp/trivy.tar.gz -C /tmp && mv /tmp/trivy /usr/local/bin/trivy && chmod +x /usr/local/bin/trivy \
	&& rm -rf /tmp/trivy* \
	&& update-ca-certificates || true

# Create a non-root user but add it to the root group so it can access
# the Docker socket when the socket is owned by root:root with group
# permissions (typical on some hosts). This keeps the process UID non-root
# while allowing group access to the socket.
RUN adduser -D -u 1001 -G root appuser \
		&& chown appuser:root /usr/local/bin/novisec-agent

USER appuser
ENTRYPOINT ["/usr/local/bin/novisec-agent"]
