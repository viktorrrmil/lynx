//
// Created by viktor on 12/9/25.
//

#include "../include/lynx/bruteforce_index.h"

#include <algorithm>
#include <cmath>
#include <chrono>
#include <fstream>
#include <iostream>

#include "../include/lynx/in_memory_vector_store.h"
#include "../include/lynx/serialization.h"

BruteForceIndex::BruteForceIndex(DistanceMetric metric) : metric_(metric) {}

bool BruteForceIndex::set_vector_store(std::shared_ptr<InMemoryVectorStore> store) {
    if (store) {
        vector_store_ = store;
        return true;
    }
    return false;
}


std::vector<std::pair<long, float>>
BruteForceIndex::search(const std::span<const float>& query, long k) const {
    if (!vector_store_ || vector_store_->data_.empty() || query.empty() ||
        query.size() != vector_store_->dimension() || k <= 0) {
        return {};
        }

    std::vector<std::pair<long, float>> temporary_results;
    temporary_results.reserve(vector_store_->dimension());

    for (size_t i = 0; i < vector_store_->size(); i++) {
        std::span<const float> stored_vector = vector_store_->get_vector(i);
        float distance = compute_distance(metric_, query, stored_vector);
        temporary_results.emplace_back(i, distance);
    }

    if (k == 1) {
        auto min_it = std::min_element(temporary_results.begin(), temporary_results.end(),
                                       [](auto &a, auto &b) {
                                           return a.second < b.second;
                                       });
        return { *min_it };
    }

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

long BruteForceIndex::size() const {
    if (!vector_store_) return 0;
    return static_cast<long>(vector_store_->size());
}

int BruteForceIndex::dimension() const {
    if (!vector_store_) return 0;
    return vector_store_->dimension();
}

IndexType BruteForceIndex::type() const {
    return IndexType::BRUTEFORCE;
}

void BruteForceIndex_free_vector(float* vector) {
    delete[] vector;
}