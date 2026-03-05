//
// Created by viktor on 3/4/26.
//

#ifndef LYNX_HNSW_INDEX_H
#define LYNX_HNSW_INDEX_H

#include <queue>
#include <random>

#include "vector_index.h"

struct Node {
    std::vector<std::vector<size_t> > neighbors;
    int top_layer;
};

const int NO_ENTRY_POINT = -1;

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

    std::mt19937 rng_;
    std::uniform_real_distribution<float> uniform_dist_;
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

    int M() const {
        return M_;
    }

    int ef_construction() const {
        return ef_construction_;
    }

    int ef_search() const {
        return ef_search_;
    }

    std::priority_queue<std::pair<float, size_t> > search_layer(
        const std::span<const float> &query,
        std::vector<size_t> entry_points,
        int ef,
        int layer
    ) const;

    void insert(size_t id, const std::span<const float>& vector);

    std::vector<size_t> select_neighbors(std::priority_queue<std::pair<float, size_t> > candidates, int max_neighbors) const;

    void prune_neighbors(size_t node_id, int layer, int max_connections);

    // Build or rebuild the HNSW graph from the vector store
    bool build();

    // Clear the graph structure
    void clear();
};

#endif //LYNX_HNSW_INDEX_H
