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
    long dimension_;
    std::vector<std::vector<float>> centroids_;
    std::vector<std::vector<long>> inverted_lists_;
    std::pmr::unordered_map<long, std::vector<float>> vectors_;
    bool is_trained_;
    std::int64_t nlist_;
    std::int64_t nprobe_;
public:
    IVFIndex() : distance_metric_(DistanceMetric::L2), dimension_(0) {}
    explicit IVFIndex(long dimension, DistanceMetric metric, std::int64_t nlist, std::int64_t nprobe);

    void set_dimension(int64_t dimension) override {
        dimension_ = dimension;
    }

    long dimension() const override {
        return dimension_;
    }

    void set_metric(DistanceMetric metric) override {
        distance_metric_ = metric;
    }

    DistanceMetric metric() const override {
        return distance_metric_;
    }

    // Finding the nearest centroid for a given vector - NOT POSSIBLE IF NOT TRAINED
    bool add_vector(long id, const std::vector<float> &vector_data) override;

    std::vector<std::pair<long, float>>
    search(const std::vector<float> &query, long k) const override;

    std::size_t size() const override;

    bool save(const std::string &path) const override;
    bool load(std::ifstream &in) override;

    IndexType type() const override;

    bool train(const std::vector<std::vector<float>> &training_data, std::int64_t n_iterations = 100, float tolerance = 1e-4);
};

#endif //LYNX_IVF_INDEX_H