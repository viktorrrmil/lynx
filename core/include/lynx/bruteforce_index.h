//
// Created by viktor on 12/9/25.
//

#ifndef LYNX_BRUTEFORCE_INDEX_H
#define LYNX_BRUTEFORCE_INDEX_H
#include <string>
#include <unordered_set>
#include <vector>

#include "vector_index.h"

class BruteForceIndex : public VectorIndex {
public:
    BruteForceIndex() : metric_(DistanceMetric::L2), dimension_(0) {}
    explicit BruteForceIndex(long dimension, DistanceMetric metric);

    void set_dimension(int64_t dimension) override {
        dimension_ = dimension;
    }

    void set_metric(DistanceMetric metric) override {
        metric_ = metric;
    }

    DistanceMetric metric() const override {
        return metric_;
    }

    bool add_vector(long id, const std::vector<float>& vector_data) override;

    std::vector<std::pair<long, float>>
    search(const std::vector<float>& query, long k) const override;

    std::size_t size() const override;

    bool save(const std::string& path) const override;
    bool load(std::ifstream &in) override;

    IndexType type() const override;

private:
    DistanceMetric metric_;
    long dimension_;
    std::vector<std::vector<float>> vectors_;
    std::vector<long> ids_;
    std::unordered_set<long> id_set_;
};

#endif //LYNX_BRUTEFORCE_INDEX_H
