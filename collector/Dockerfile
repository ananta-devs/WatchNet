FROM golang:1.22-alpine AS builder

WORKDIR /src
COPY go.mod go.sum* ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /bin/collector ./cmd/collector

FROM alpine:3.19
RUN apk add --no-cache ca-certificates libpcap
COPY --from=builder /bin/collector /usr/local/bin/collector

ENTRYPOINT ["/usr/local/bin/collector"]
