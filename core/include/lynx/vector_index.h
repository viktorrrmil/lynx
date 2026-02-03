//
// Created by viktor on 12/10/25.
//

#ifndef LYNX_VECTOR_INDEX_H
#define LYNX_VECTOR_INDEX_H
#include <vector>
#include <cstddef>
#include <memory>

#include "utils/metric.h"

enum class IndexType : int64_t {
    BRUTEFORCE = 1,
    IVF = 2,
    HNSW = 3
};


namespace std {
    template <>
    struct hash<IndexType> {
        std::size_t operator()(IndexType t) const noexcept {
            return static_cast<std::size_t>(t);
        }
    };
}

class VectorIndex {
public:
    virtual ~VectorIndex() = default;

    virtual DistanceMetric distance_metric() const = 0;
    virtual void set_distance_metric(DistanceMetric distance_metric) = 0;

    virtual std::vector<std::pair<long, float>>
    search(const std::span<const float>& query, long k) const = 0;

    virtual bool set_vector_store(std::shared_ptr<class InMemoryVectorStore> store) = 0;

    virtual IndexType type() const = 0;
};

#endif //LYNX_VECTOR_INDEX_H