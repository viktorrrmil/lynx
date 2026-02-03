FROM --platform=linux/amd64 golang:alpine AS builder

RUN apk add --no-cache gcc g++ musl-dev make

WORKDIR /app

COPY bindings/go/go.mod bindings/go/go.sum /app/
RUN go mod download

COPY include/ /app/include/
COPY src/ /app/src/
COPY bindings/go/ /app/

RUN mkdir -p /app/lib

RUN g++ -std=c++20 -shared -fPIC \
    -I/app/include \
    -o /app/lib/liblynx_go.so \
    /app/wrapper/bruteforce_index_wrapper.cpp \
    /app/wrapper/ivf_index_wrapper.cpp \
    /app/wrapper/in_memory_vector_store_wrapper.cpp \
    /app/src/bruteforce_index.cpp \
    /app/src/ivf_index.cpp \
    /app/src/in_memory_vector_store.cpp \
    /app/src/serialization.cpp \
    /app/src/index_loader.cpp \
    /app/src/index_registry.cpp \
    /app/src/utils/metric.cpp \
    /app/src/utils/k_means/kmeans.cpp

RUN CGO_ENABLED=1 \
    CGO_CFLAGS="-I/app/core/include" \
    CGO_LDFLAGS="-L/app/lib -llynx_go -lstdc++" \
    go build -o /lynx-api ./cmd/api

FROM --platform=linux/amd64 alpine:latest
RUN apk add --no-cache libstdc++

COPY --from=builder /lynx-api /lynx-api
COPY --from=builder /app/lib/liblynx_go.so /lib/

EXPOSE 8080

CMD ["/lynx-api"]