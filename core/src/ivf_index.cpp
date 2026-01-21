//
// Created by viktor on 1/21/26.
//

#include "../include/lynx/ivf_index.h"

#include <algorithm>
#include <limits>

#include "../include/lynx/utils/kmeans.h"

IVFIndex::IVFIndex(long dimension, DistanceMetric metric, std::int64_t nlist, std::int64_t nprobe)
    : dimension_(dimension), distance_metric_(metric), nlist_(nlist), nprobe_(nprobe) {
    centroids_.reserve(nlist_);
    inverted_lists_.resize(nlist_);
    is_trained_ = false;
}

bool IVFIndex::add_vector(long id, const std::vector<float> &vector_data) {
    if (!is_trained_) {
        return false;
    }

    if (vector_data.size() != dimension_) {
        return false;
    }

    // Find nearest centroid
    float min_distance = std::numeric_limits<float>::infinity();
    std::int64_t best_centroid = -1;

    for (std::int64_t i = 0; i < centroids_.size(); i++) {
        float distance = compute_distance(distance_metric_, vector_data, centroids_[i]);
        if (distance < min_distance) {
            min_distance = distance;
            best_centroid = i;
        }
    }

    if (best_centroid == -1) {
        return false;
    }

    inverted_lists_[best_centroid].push_back(id);
    vectors_[id] = vector_data;

    return true;
}

std::vector<std::pair<long, float>>
IVFIndex::search(const std::vector<float> &query, long k) const {
    if (!is_trained_) {
        return {};
    }

    // Looking for the nearest centroids
    std::vector<std::pair<std::int64_t, float>> centroid_distances;
    for (std::int64_t i = 0; i < centroids_.size(); i++) {
        float distance = compute_distance(distance_metric_, query, centroids_[i]);
        centroid_distances.emplace_back(i, distance);
    }

    std::sort(centroid_distances.begin(), centroid_distances.end(),
              [](const auto &a, const auto &b) { return a.second < b.second; });

    std::vector<std::pair<long, float>> results;

    for (std::int64_t i = 0; i < std::min(nprobe_, static_cast<std::int64_t>(centroid_distances.size())); i++) {
        std::int64_t centroid_index = centroid_distances[i].first;

        for (long id : inverted_lists_[centroid_index]) {
            const std::vector<float>& stored_vector = vectors_.at(id);
            float distance = compute_distance(distance_metric_, query, stored_vector);
            results.emplace_back(id, distance);
        }
    }

    std::sort(results.begin(), results.end(),
              [](const auto &a, const auto &b) { return a.second < b.second; });

    if (results.size() > k) {
        results.resize(k);
    }

    return results;
}

std::size_t IVFIndex::size() const {
    return vectors_.size();
}

bool IVFIndex::save(const std::string &path) const {
    // TODO: Implement IVFIndex saving
    return false;
}

bool IVFIndex::load(std::ifstream &in) {
    // TODO: Implement IVFIndex loading
    return false;
}

IndexType IVFIndex::type() const {
    return IndexType::IVF;
}

bool IVFIndex::train(const std::vector<std::vector<float> > &training_data, std::int64_t n_iterations, float tolerance) {
    if (training_data.empty() || training_data[0].size() != dimension_) {
        return false;
    }

    auto kmeans_result = kmeans(training_data, nlist_, n_iterations, tolerance);
    centroids_ = kmeans_result.centroids;
    is_trained_ = true;

    return true;
}
