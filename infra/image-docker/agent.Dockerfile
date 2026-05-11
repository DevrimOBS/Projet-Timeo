FROM golang:1.23-alpine AS builder

WORKDIR /build

RUN apk add --no-cache git ca-certificates

COPY agent/go.mod agent/go.sum ./
RUN go mod download

COPY agent/ ./

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /out/novisec-agent ./src/main.go

FROM alpine:3.20

WORKDIR /app

RUN apk add --no-cache ca-certificates tzdata && \
    addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder /out/novisec-agent /app/novisec-agent
COPY agent/configs /app/configs

USER appuser

ENTRYPOINT ["/app/novisec-agent"]