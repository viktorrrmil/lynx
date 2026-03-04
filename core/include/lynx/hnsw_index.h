//
// Created by viktor on 3/4/26.
//

#ifndef LYNX_HNSW_INDEX_H
#define LYNX_HNSW_INDEX_H

#include <queue>

#include "vector_index.h"

struct Node {
    std::vector<std::vector<size_t> > neighbors;
    int top_layer;
};

class HNSWIndex : public VectorIndex {
private:
    DistanceMetric distance_metric_;
    std::shared_ptr<InMemoryVectorStore> vector_store_;

    // HNSW specific members
    int M_;
    int m_max0_; // 2 * M_
    int ef_construction_;
    int ef_search_;
    float ml_; // 1.0 / log(M_);
    size_t entry_point_;
    int max_layer_;
    std::vector<Node> nodes_;

public:
    HNSWIndex() : distance_metric_(DistanceMetric::L2) {
    }

    explicit HNSWIndex(DistanceMetric metric, int M, int ef_construction, int ef_search);

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

    std::priority_queue<std::pair<float, size_t> > search_layer(
        const std::span<const float> &query,
        std::vector<size_t> entry_points,
        int ef,
        int layer
    ) const;

    void insert(size_t id, const std::span<const float>& vector);
};

#endif //LYNX_HNSW_INDEX_H
