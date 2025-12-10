//
// Created by viktor on 12/9/25.
//

#ifndef LYNX_BRUTEFORCE_INDEX_H
#define LYNX_BRUTEFORCE_INDEX_H
#include <unordered_set>
#include <vector>

class BruteForceIndex {
public:
    explicit BruteForceIndex(long dimension);

    bool add_vector(long id, const std::vector<float>& vector_data);

    std::vector<std::pair<long, float>>
    search(const std::vector<float>& query, long k) const;

    std::size_t size() const;

private:
    long dimension_;
    std::vector<std::vector<float>> vectors_;
    std::vector<long> ids_;
    std::unordered_set<long> id_set_;

    float l2_distance(const std::vector<float>& vector_a, const std::vector<float>& vector_b) const;
};

#endif //LYNX_BRUTEFORCE_INDEX_H
