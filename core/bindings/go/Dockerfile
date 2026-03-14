FROM --platform=linux/amd64 golang:1.22-bullseye AS builder

RUN apt-get update \
    && apt-get install -y --no-install-recommends gcc g++ make libgomp1 \
    && rm -rf /var/lib/apt/lists/*

ENV GOTOOLCHAIN=auto

WORKDIR /app

COPY bindings/go/go.mod bindings/go/go.sum /app/
RUN go mod download

COPY include/ /app/include/
COPY src/ /app/src/
COPY bindings/go/ /app/

RUN mkdir -p /app/lib

RUN g++ -std=c++20 -shared -fPIC -fopenmp -O3 \
    -I/app/include \
    -o /app/lib/liblynx_go.so \
    /app/src/bruteforce_index.cpp \
    /app/src/ivf_index.cpp \
    /app/src/ivf_pq_index.cpp \
    /app/src/hnsw_index.cpp \
    /app/src/in_memory_vector_store.cpp \
    /app/src/serialization.cpp \
    /app/src/index_loader.cpp \
    /app/src/index_registry.cpp \
    /app/src/utils/metric.cpp \
    /app/src/utils/k_means/kmeans.cpp \
    /app/src/utils/logging.cpp \
    /app/wrapper/bruteforce_index_wrapper.cpp \
    /app/wrapper/ivf_index_wrapper.cpp \
    /app/wrapper/ivf_pq_index_wrapper.cpp \
    /app/wrapper/hnsw_index_wrapper.cpp \
    /app/wrapper/in_memory_vector_store_wrapper.cpp

# Verify HNSW symbols are present
RUN nm -D /app/lib/liblynx_go.so | grep -i hnsw || echo "WARNING: HNSW symbols not found!"

RUN CGO_ENABLED=1 \
    CGO_CFLAGS="-I/app/include -fgnu89-inline" \
    CGO_LDFLAGS="-L/app/lib -llynx_go -lstdc++ -Wl,--allow-multiple-definition" \
    go build -o /lynx-api ./cmd/api

FROM --platform=linux/amd64 debian:bullseye-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends libstdc++6 libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
RUN mkdir -p /app/data

COPY --from=builder /lynx-api /lynx-api
COPY --from=builder /app/lib/liblynx_go.so /lib/

EXPOSE 8080

CMD ["/lynx-api"]
