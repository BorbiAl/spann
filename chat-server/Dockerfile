FROM golang:1.24-alpine3.22 AS builder

WORKDIR /src

COPY go.mod .
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o /out/chat-server ./main.go

FROM alpine:3.22

RUN apk add --no-cache ca-certificates wget \
	&& addgroup -S spann \
	&& adduser -S spann -G spann
WORKDIR /app

COPY --from=builder /out/chat-server /app/chat-server

USER spann
EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=5s --retries=5 CMD wget --spider -q http://localhost:8080/health || exit 1

CMD ["/app/chat-server"]
