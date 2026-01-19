FROM --platform=linux/amd64 golang:alpine AS builder

# Install build dependencies
RUN apk add --no-cache gcc g++ musl-dev make

WORKDIR /app

# Copy go mod files (from bindings/go)
COPY bindings/go/go.mod bindings/go/go.sum /app/
RUN go mod download

# Copy everything needed
COPY include/ /app/include/
COPY src/ /app/src/
COPY bindings/go/ /app/

# Create lib directory FIRST
RUN mkdir -p /app/lib

# Build C++ wrapper
RUN g++ -std=c++20 -shared -fPIC \
    -I/app/include \
    -o /app/lib/liblynx_go.so \
    /app/wrapper/bruteforce_index_wrapper.cpp \
    /app/src/bruteforce_index.cpp \
    /app/src/serialization.cpp \
    /app/src/index_loader.cpp \
    /app/src/index_registry.cpp \
    /app/src/utils/metric.cpp

# Build Go binary
RUN CGO_ENABLED=1 \
    CGO_CFLAGS="-I/app/include" \
    CGO_LDFLAGS="-L/app/lib -llynx_go -lstdc++" \
    go build -o /lynx-api /app/cmd/api/main.go

# Runtime image
FROM --platform=linux/amd64 alpine:latest
RUN apk add --no-cache libstdc++

COPY --from=builder /lynx-api /lynx-api
COPY --from=builder /app/lib/liblynx_go.so /lib/

EXPOSE 8080

CMD ["/lynx-api"]