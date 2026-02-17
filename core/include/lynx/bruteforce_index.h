//
// Created by viktor on 12/9/25.
//

#ifndef LYNX_BRUTEFORCE_INDEX_H
#define LYNX_BRUTEFORCE_INDEX_H
#include <string>
#include <unordered_set>
#include <vector>

#include "in_memory_vector_store.h"
#include "vector_index.h"
#include "vector_store.h"

class BruteForceIndex : public VectorIndex {
private:
    DistanceMetric distance_metric_;
    std::shared_ptr<InMemoryVectorStore> vector_store_;

public:
    BruteForceIndex() : distance_metric_(DistanceMetric::L2) {
    }

    explicit BruteForceIndex(DistanceMetric metric);

    void set_distance_metric(DistanceMetric metric) override {
        distance_metric_ = metric;
    }

    DistanceMetric distance_metric() const override {
        return distance_metric_;
    }

    std::vector<std::pair<long, float> >
    search(const std::span<const float> &query, long k) const override;

    IndexType type() const override;

    bool set_vector_store(std::shared_ptr<InMemoryVectorStore> store) override;

    size_t size() const;

    int dimension() const;

    bool is_initialized() const {
        return vector_store_ != nullptr;
    }
};

#endif //LYNX_BRUTEFORCE_INDEX_H
