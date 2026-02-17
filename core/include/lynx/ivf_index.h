//
// Created by viktor on 1/21/26.
//

#ifndef LYNX_IVF_INDEX_H
#define LYNX_IVF_INDEX_H
#include <string>
#include <unordered_map>

#include "vector_index.h"

class IVFIndex : public VectorIndex {
private:
    DistanceMetric distance_metric_;
    std::shared_ptr<InMemoryVectorStore> vector_store_;

    // IVF specific members
    std::vector<std::vector<float> > centroids_;
    std::vector<std::vector<std::size_t> > inverted_lists_;
    bool is_trained_;
    std::int64_t nlist_;
    std::int64_t nprobe_;

public:
    IVFIndex() : distance_metric_(DistanceMetric::L2) {
    }

    explicit IVFIndex(DistanceMetric metric, std::int64_t nlist, std::int64_t nprobe);

    void set_distance_metric(DistanceMetric metric) override {
        distance_metric_ = metric;
    }

    DistanceMetric distance_metric() const override {
        return distance_metric_;
    }

    int64_t nlist() const {
        return nlist_;
    }

    int64_t nprobe() const {
        return nprobe_;
    }

    void set_nprobe(int64_t nprobe) {
        nprobe_ = nprobe;
    }

    std::vector<std::pair<long, float> >
    search(const std::span<const float> &query, long k) const override;

    IndexType type() const override;

    bool set_vector_store(std::shared_ptr<InMemoryVectorStore> store) override;

    size_t size() const;

    int dimension() const;

    // IVF specific methods
    bool train(const std::vector<std::vector<float> > &training_data, std::int64_t n_iterations = 100,
               float tolerance = 1e-4, bool populate_inverted_lists = false);

    bool update_vectors();

    bool is_initialized() const {
        return is_trained_ && !centroids_.empty() && !inverted_lists_.empty();
    }
};

#endif //LYNX_IVF_INDEX_H
