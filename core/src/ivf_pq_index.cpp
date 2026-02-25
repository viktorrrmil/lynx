//
// Created by viktor on 2/22/26.
//

#include "lynx/ivf_pq_index.h"

#include <algorithm>
#include <cmath>
#include <iostream>
#include <limits>

#include "../include/lynx/utils/kmeans.h"
#include "lynx/in_memory_vector_store.h"
#include "lynx/utils/logging.h"

IVFPQIndex::IVFPQIndex(DistanceMetric metric, std::int64_t nlist, std::int64_t nprobe)
    : distance_metric_(metric), nlist_(nlist), nprobe_(nprobe) {
    centroids_.reserve(nlist_);
    inverted_lists_.resize(nlist_);
    is_trained_ = false;
}

std::vector<std::pair<long, float> >
IVFPQIndex::search(const std::span<const float> &query, long k) const {
    if (!is_trained_) {
        return {};
    }

    // Looking for the nearest centroids
    std::vector<std::pair<std::int64_t, float> > centroid_distances;
    for (std::int64_t i = 0; i < centroids_.size(); i++) {
        float distance = compute_distance(distance_metric_, query, centroids_[i]);
        centroid_distances.emplace_back(i, distance);
    }

    std::sort(centroid_distances.begin(), centroid_distances.end(),
              [](const auto &a, const auto &b) { return a.second < b.second; });

    std::vector<std::pair<long, float> > results;

    for (std::int64_t i = 0; i < std::min(nprobe_, static_cast<std::int64_t>(centroid_distances.size())); i++) {
        std::int64_t centroid_index = centroid_distances[i].first;

        for (long id: inverted_lists_[centroid_index]) {
            const std::span<const float> &stored_vector = vector_store_->get_vector(id);

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

IndexType IVFPQIndex::type() const {
    return IndexType::IVF;
}

// Called when setting a new vector store, called only once
bool IVFPQIndex::train(const std::vector<std::vector<float> > &training_data, std::int64_t n_iterations,
                     float tolerance, bool populate_inverted_lists) {
    // IVF training
    if (training_data.empty() || training_data[0].size() != dimension()) {
        return false;
    }

    auto kmeans_result = kmeans(training_data, nlist_, n_iterations, tolerance, distance_metric_);
    centroids_ = std::move(kmeans_result.centroids);
    is_trained_ = true;

    if (populate_inverted_lists) {
        inverted_lists_.clear();
        inverted_lists_.resize(centroids_.size());
        for (size_t i = 0; i < kmeans_result.assignments.size(); i++) {
            int cluster = kmeans_result.assignments[i];
            if (cluster >= 0 && cluster < static_cast<int>(inverted_lists_.size())) {
                inverted_lists_[cluster].push_back(i);
            }
        }
    }

    // PQ codebook training
    for (std::int64_t i = 0; i < m_; i++) {
        std::vector<std::vector<float>> subspace_data;
        for (const auto& vec: training_data) {
            std::vector<float> subvector(vec.begin() + i * compressed_dim_, vec.begin() + (i + 1) & compressed_dim_);
            subspace_data.push_back(std::move(subvector));
        }

        auto pq_kmeans_result = kmeans(subspace_data, codebook_size_, n_iterations, tolerance, distance_metric_);
        pq_codebooks_.push_back(std::move(pq_kmeans_result.centroids));
    }

    // TODO: Encode vectors with PQ

    return true;
}

bool IVFPQIndex::set_vector_store(std::shared_ptr<InMemoryVectorStore> store) {
    if (store) {
        vector_store_ = store;

        if (!vector_store_->data_.empty()) {
            float first_vec_magnitude = 0.0f;
            for (float val : vector_store_->data_[0]) {
                first_vec_magnitude += val * val;
            }
            first_vec_magnitude = std::sqrt(first_vec_magnitude);

            debug_log("First vector magnitude: " + std::to_string(first_vec_magnitude));
            debug_log("Expected for normalized: 1.0");
        }

        // I'm clearing previous centroids and inverted lists so that
        // it's possible to switch vector stores and retrain

        centroids_.clear();
        inverted_lists_.clear();
        is_trained_ = false;

        // Case when the vector store doesn't have any vectors yet
        if (vector_store_->size() == 0) {
            return true;
        }

        int max_iterations = 20;
        train(vector_store_->data_, max_iterations, 1e-4, true);

        return true;
    }
    return false;
}

bool IVFPQIndex::update_vectors() {
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

std::size_t IVFPQIndex::size() const {
    if (!vector_store_) return 0;
    return vector_store_->size();
}

int IVFPQIndex::dimension() const {
    if (!vector_store_) return 0;
    return vector_store_->dimension();
}
