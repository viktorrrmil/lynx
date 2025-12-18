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
    BruteForceIndex() : dimension_(0) {}
    explicit BruteForceIndex(long dimension);

    void set_dimension(int64_t dimension) override {
        dimension_ = dimension;
    }

    bool add_vector(long id, const std::vector<float>& vector_data);

    std::vector<std::pair<long, float>>
    search(const std::vector<float>& query, long k) const;

    std::size_t size() const;

    bool save(const std::string& path) const;
    bool load(std::ifstream &in);

    IndexType type() const;

private:
    long dimension_;
    std::vector<std::vector<float>> vectors_;
    std::vector<long> ids_;
    std::unordered_set<long> id_set_;

    float l2_distance(const std::vector<float>& vector_a, const std::vector<float>& vector_b) const;
};

#endif //LYNX_BRUTEFORCE_INDEX_H
