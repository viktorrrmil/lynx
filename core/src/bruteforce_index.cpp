//
// Created by viktor on 12/9/25.
//

#include "../include/lynx/bruteforce_index.h"

#include <algorithm>
#include <cmath>
#include <fstream>

#include "../include/lynx/serialization.h"

BruteForceIndex::BruteForceIndex(long dimension, DistanceMetric metric)
    : metric_(metric), dimension_(dimension)
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
        float distance = compute_distance(metric_, query, stored_vector);

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

bool BruteForceIndex::save(const std::string& path) const {
    std::ofstream out(path, std::ios::binary);
    if (!out.is_open()) {
        return false;
    }

    // Magic
    if (!write_magic(out)) {
        return false;
    }

    // Version
    if (!write_int64(out, VERSION)) {
        return false;
    }

    // Index type
    if (!write_int64(out, static_cast<int64_t>(type()))) {
        return false;
    }

    // Metric
    if (!write_int64(out, static_cast<int64_t>(metric_))) {
        return false;
    }

    // Dimension
    if (!write_int64(out, dimension_)) {
        return false;
    }

    // Vector count
    if (!write_int64(out, static_cast<int64_t>(vectors_.size()))) {
        return false;
    }

    for (size_t i = 0; i < ids_.size(); i++) {
        if (!write_int64(out, ids_[i])) {
            return false;
        }

        if (!write_float_vector(out, vectors_[i])) {
            return false;
        }
    }

    return true;
}

bool BruteForceIndex::load(std::ifstream &in) {
    if (dimension_ <= 0) {
        return false;
    }

    int64_t vector_count;
    if (!read_int64(in, vector_count)) {
        return false;
    }
    if (vector_count < 0) {
        return false;
    }

    vectors_.clear();
    ids_.clear();
    id_set_.clear();

    for (int64_t i = 0; i < vector_count; i++) {
        long id;
        if (!read_int64(in, id)) {
            return false;
        }

        if (id_set_.count(id)) {
            return false;
        }

        std::vector<float> vector_data;
        if (!read_float_vector(in, vector_data, dimension_)) {
            return false;
        }

        ids_.push_back(id);
        vectors_.push_back(vector_data);
        id_set_.insert(id);
    }

    return true;
}

IndexType BruteForceIndex::type() const {
    return IndexType::BRUTEFORCE;
}