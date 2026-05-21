FROM golang:1.22-alpine

WORKDIR /app
COPY go.mod ./
COPY src ./src
RUN go build -o /usr/local/bin/novisec-agent ./src

# Create a non-root user but add it to the root group so it can access
# the Docker socket when the socket is owned by root:root with group
# permissions (typical on some hosts). This keeps the process UID non-root
# while allowing group access to the socket.
RUN adduser -D -u 1001 -G root appuser \
	&& chown appuser:root /usr/local/bin/novisec-agent

USER appuser
ENTRYPOINT ["/usr/local/bin/novisec-agent"]
