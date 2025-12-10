//
// Created by viktor on 12/9/25.
//

#include "bruteforce_index.h"

#include <algorithm>
#include <cmath>

BruteForceIndex::BruteForceIndex(long dimension)
    : dimension_(dimension)
{
    vectors_.reserve(1024);
    ids_.reserve(1024);
    id_set_.reserve(1024);
}

bool BruteForceIndex::add_vector(long id, const std::vector<float>& vector_data) {
    if (vector_data.size() != dimension_) {
        return false;
    }

    if (id < 0) {
        return false;
    }

    if (id_set_.count(id)) return false;

    id_set_.insert(id);
    ids_.push_back(id);
    vectors_.push_back(vector_data);

    return true;
}

std::vector<std::pair<long, float>>
BruteForceIndex::search(const std::vector<float>& query, long k) const {
    if (query.empty() || query.size() != dimension_ || k <= 0) {
        return {};
    }

    std::vector<std::pair<long, float>> temporary_results;
    temporary_results.reserve(vectors_.size());

    for (size_t i = 0; i < vectors_.size(); i++) {
        const std::vector<float>& stored_vector = vectors_[i];
        float distance = l2_distance(query, stored_vector);

        temporary_results.emplace_back(ids_[i], distance);
    }

    if (k == 1) {
        auto min_it = std::min_element(temporary_results.begin(), temporary_results.end(),
                                       [](auto &a, auto &b) {
                                           return a.second < b.second;
                                       });
        return { *min_it };
    } else {
        std::sort(temporary_results.begin(), temporary_results.end(),
              [](auto &a, auto &b) {
                  return a.second < b.second;
              });

        std::vector<std::pair<long, float>> results;
        results.reserve(k);

        size_t limit = std::min(static_cast<size_t>(k), temporary_results.size());
        for (size_t i = 0; i < limit; i++) {
            results.push_back(temporary_results[i]);
        }

        return results;
    }
}

size_t BruteForceIndex::size() const {
    return vectors_.size();
}

float BruteForceIndex::l2_distance(const std::vector<float>& vector_a, const std::vector<float>& vector_b) const {
    float sum = 0.0;

    for (size_t i = 0; i < vector_a.size(); i++) {
        float diff = vector_a[i] - vector_b[i];
        sum += diff * diff;
    }

    return std::sqrt(sum);
}