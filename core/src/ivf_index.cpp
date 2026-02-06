//
// Created by viktor on 1/21/26.
//

#include "../include/lynx/ivf_index.h"

#include <algorithm>
#include <iostream>
#include <limits>

#include "../include/lynx/utils/kmeans.h"
#include "lynx/in_memory_vector_store.h"
#include "lynx/utils/logging.h"

IVFIndex::IVFIndex(DistanceMetric metric, std::int64_t nlist, std::int64_t nprobe)
    : distance_metric_(metric), nlist_(nlist), nprobe_(nprobe) {
    centroids_.reserve(nlist_);
    inverted_lists_.resize(nlist_);
    is_trained_ = false;
}

std::vector<std::pair<long, float> >
IVFIndex::search(const std::span<const float> &query, long k) const {
    if (!is_trained_) {
        return {};
    }

    // DEBUG LOG
    // debug_log("=== IVF SEARCH C++ DEBUG ===");
    // debug_log("Distance metric: " + std::to_string(static_cast<int>(distance_metric_)));
    // debug_log("Query size: " + std::to_string(query.size()));
    // debug_log("Query first 5: ");
    // for (size_t i = 0; i < std::min(query.size(), static_cast<size_t>(5)); i++) {
    //     debug_log("  " + std::to_string(query[i]));
    // }

    // Looking for the nearest centroids
    std::vector<std::pair<std::int64_t, float> > centroid_distances;
    for (std::int64_t i = 0; i < centroids_.size(); i++) {
        float distance = compute_distance(distance_metric_, query, centroids_[i]);
        centroid_distances.emplace_back(i, distance);
    }

    // debug_log("First centroid distance: " + std::to_string(centroid_distances[0].second));

    std::sort(centroid_distances.begin(), centroid_distances.end(),
              [](const auto &a, const auto &b) { return a.second < b.second; });

    std::vector<std::pair<long, float> > results;

    for (std::int64_t i = 0; i < std::min(nprobe_, static_cast<std::int64_t>(centroid_distances.size())); i++) {
        std::int64_t centroid_index = centroid_distances[i].first;

        // debug_log("Probing centroid index: " + std::to_string(centroid_index) + ", inv list size: " + std::to_string(inverted_lists_[centroid_index].size()));

        for (long id: inverted_lists_[centroid_index]) {
            const std::span<const float> &stored_vector = vector_store_->get_vector(id);

            // debug_log("First stored vector id: " + std::to_string(id) + ", first 5 values: ");
            // for (size_t j = 0; j < std::min(stored_vector.size(), static_cast<size_t>(5)); j++) {
            //     debug_log("  " + std::to_string(stored_vector[j]));
            // }

            float distance = compute_distance(distance_metric_, query, stored_vector);

            // if (results.size() < 3) {
            //     debug_log("Distance to vector id " + std::to_string(id) + ": " + std::to_string(distance));
            // }

            results.emplace_back(id, distance);
        }
    }

    // debug_log("Total candidates: " + std::to_string(results.size()));
    // debug_log("=================================");

    std::sort(results.begin(), results.end(),
              [](const auto &a, const auto &b) { return a.second < b.second; });

    if (results.size() > k) {
        results.resize(k);
    }

    // debug_log("Sending final results to Go, count: " + std::to_string(results.size()));
    // for (size_t i = 0; i < results.size(); i++) {
    //     debug_log("Final result " + std::to_string(i) + ": id=" + std::to_string(results[i].first) + ", distance=" + std::to_string(results[i].second));
    // }

    return results;
}

IndexType IVFIndex::type() const {
    return IndexType::IVF;
}

// Called when setting a new vector store, called only once
bool IVFIndex::train(const std::vector<std::vector<float> > &training_data, std::int64_t n_iterations,
                     float tolerance) {
    if (training_data.empty() || training_data[0].size() != dimension()) {
        return false;
    }

    auto kmeans_result = kmeans(training_data, nlist_, n_iterations, tolerance);
    centroids_ = kmeans_result.centroids;
    is_trained_ = true;

    return true;
}

bool IVFIndex::set_vector_store(std::shared_ptr<InMemoryVectorStore> store) {
    if (store) {
        vector_store_ = store;

        // I'm clearing previous centroids and inverted lists so that
        // it's possible to switch vector stores and retrain

        centroids_.clear();
        inverted_lists_.clear();
        is_trained_ = false;

        // Case when the vector store doesn't have any vectors yet
        if (vector_store_->size() == 0) {
            return true;
        }

        train(vector_store_->data_, 100, 1e-4);

        inverted_lists_.resize(centroids_.size());

        for (std::size_t i = 0; i < vector_store_->data_.size(); i++) {
            const auto &vector = vector_store_->get_vector(i);

            // Find the nearest centroid
            float min_distance = std::numeric_limits<float>::max();
            std::size_t min_index = 0;

            for (std::size_t j = 0; j < centroids_.size(); j++) {
                float tmp_distance = compute_distance(distance_metric_, vector, centroids_[j]);

                if (tmp_distance < min_distance) {
                    min_distance = tmp_distance;
                    min_index = j;
                }
            }

            inverted_lists_[min_index].push_back(i);
        }

        return true;
    }
    return false;
}

bool IVFIndex::update_vectors() {
    if (vector_store_ == nullptr) {
        return false;
    }

    if (!is_trained_) {
        train(vector_store_->data_, 100, 1e-4);
        inverted_lists_.resize(centroids_.size());
    }

    int accounted_vector_count = 0;
    for (const auto &list : inverted_lists_) {
        accounted_vector_count += list.size();
    }

    if (accounted_vector_count == vector_store_->size()) {
        return true; // No new vectors to add
    }

    std::size_t actual_vector_count = vector_store_->data_.size();

    if (accounted_vector_count > actual_vector_count) {
        // Index is corrupted (more vectors accounted than exist)
        std::cerr << "ERROR: Index corruption detected. Accounted: "
                  << accounted_vector_count << ", Actual: "
                  << actual_vector_count << std::endl;
        return false;
    }

    for (std::size_t i = accounted_vector_count; i < vector_store_->data_.size(); i++) {
        const auto &vector = vector_store_->get_vector(i);

        // Find the nearest centroid
        float min_distance = std::numeric_limits<float>::max();
        std::size_t min_index = 0;

        for (std::size_t j = 0; j < centroids_.size(); j++) {
            float tmp_distance = compute_distance(distance_metric_, vector, centroids_[j]);

            if (tmp_distance < min_distance) {
                min_distance = tmp_distance;
                min_index = j;
            }
        }

        if (min_index < inverted_lists_.size()) {
            inverted_lists_[min_index].push_back(i);
        } else {
            std::cerr << "ERROR: Invalid centroid index: " << min_index << std::endl;
            return false;
        }
    }

    return true;
}

std::size_t IVFIndex::size() const {
    if (!vector_store_) return 0;
    return vector_store_->size();
}

int IVFIndex::dimension() const {
    if (!vector_store_) return 0;
    return vector_store_->dimension();
}
