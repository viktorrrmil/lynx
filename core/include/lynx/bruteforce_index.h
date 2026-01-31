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
    DistanceMetric metric_;
    std::shared_ptr<InMemoryVectorStore> vector_store_;
public:
    BruteForceIndex() : metric_(DistanceMetric::L2) {}
    explicit BruteForceIndex(DistanceMetric metric);

    void set_metric(DistanceMetric metric) override {
        metric_ = metric;
    }

    DistanceMetric metric() const override {
        return metric_;
    }

    std::vector<std::pair<long, float>>
    search(const std::span<const float>& query, long k) const override;

    IndexType type() const override;

    bool set_vector_store(std::shared_ptr<InMemoryVectorStore> store) override;

    long size() const;
    int dimension() const;
};

#endif //LYNX_BRUTEFORCE_INDEX_H
