//
// Created by viktor on 12/9/25.
//

#ifndef LYNX_BRUTEFORCE_INDEX_H
#define LYNX_BRUTEFORCE_INDEX_H
#include <vector>

class BruteForceIndex {
public:
    explicit BruteForceIndex(long dimension);

    bool add_vector(long id, const std::vector<float>& vector_data);

    std::vector<std::pair<long, float>>
    search(const float* query, long k) const;

    long size() const;

private:
    long dimension_;
    std::vector<std::vector<float>> vectors_;
    std::vector<long> ids_;
};

#endif //LYNX_BRUTEFORCE_INDEX_H
