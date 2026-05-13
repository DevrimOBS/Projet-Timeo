FROM golang:1.22-alpine
WORKDIR /app
COPY go.mod ./
COPY src ./src
RUN go build -o /usr/local/bin/novisec-agent ./src
ENTRYPOINT ["novisec-agent"]
