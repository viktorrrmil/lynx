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

IVFPQIndex::IVFPQIndex(DistanceMetric metric, std::int64_t nlist, std::int64_t nprobe, std::int64_t m, std::int64_t codebook_size)
    : distance_metric_(metric), nlist_(nlist), nprobe_(nprobe), m_(m), codebook_size_(codebook_size) {
    centroids_.reserve(nlist_);
    inverted_lists_.resize(nlist_);
    is_trained_ = false;
    compressed_dim_ = 0; // Will be set during training based on the input data dimension
}

std::vector<std::uint8_t> IVFPQIndex::encode_vector(const std::span<const float> &vector) const {
    std::vector<std::uint8_t> code(m_);

    for (std::int64_t i = 0; i < m_; i++) {
        std::vector<float> subspace;
        for (int j = 0; j < compressed_dim_; j++) {
            subspace.push_back(vector[i * compressed_dim_ + j]);
        }

        const auto& codebook = pq_codebooks_[i];
        int best_index = 0;
        float best_distance = compute_distance(distance_metric_, subspace, codebook[0]);
        for (size_t j = 1; j < codebook.size(); j++) {
            float distance = compute_distance(distance_metric_, subspace, codebook[j]);
            if (distance < best_distance) {
                best_distance = distance;
                best_index = j;
            }
        }

        code[i] = static_cast<std::uint8_t>(best_index);
        if (best_index >= codebook.size()) {
            // TODO: This should never happen, but just in case
            std::cerr << "ERROR: Best index " << best_index << " exceeds codebook size " << codebook.size() << std::endl;
            return {};
        }
    }

    return code;
}

std::vector<float> IVFPQIndex::reconstruct_vector(const std::vector<std::uint8_t> &code) const {
    std::vector<float> results;

    for (int i = 0; i < m_; i++) {
        int codebook_index = static_cast<int>(code[i]);
        if (codebook_index >= 0 && codebook_index < static_cast<int>(pq_codebooks_[i].size())) {
            const std::vector<float>& centroid = pq_codebooks_[i][codebook_index];
            results.insert(results.end(), centroid.begin(), centroid.end());
        } else {
            std::cerr << "ERROR: Invalid PQ code index: " << codebook_index << " for subspace " << i << std::endl;
            results.insert(results.end(), compressed_dim_, 0.0f);
        }
    }

    return results;
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

    // Precompute distance tables for Asymmetric Distance Computation (ADC)
    // For each subspace m, compute distance from query subvector to all k centroids
    // This is much faster than reconstructing vectors and computing full distances
    std::vector<std::vector<float>> distance_tables(m_);
    for (std::int64_t m = 0; m < m_; m++) {
        distance_tables[m].resize(codebook_size_);

        // Extract query subvector for this subspace
        std::vector<float> query_subvec(query.begin() + m * compressed_dim_,
                                         query.begin() + (m + 1) * compressed_dim_);

        // Compute distance to each centroid in this subspace's codebook
        for (std::int64_t c = 0; c < codebook_size_ && c < static_cast<std::int64_t>(pq_codebooks_[m].size()); c++) {
            if (distance_metric_ == DistanceMetric::L2) {
                // For L2, we store squared distance to avoid sqrt in inner loop
                float dist_sq = 0.0f;
                for (std::int64_t d = 0; d < compressed_dim_; d++) {
                    float diff = query_subvec[d] - pq_codebooks_[m][c][d];
                    dist_sq += diff * diff;
                }
                distance_tables[m][c] = dist_sq;
            } else {
                // For cosine, compute component-wise
                distance_tables[m][c] = compute_distance(distance_metric_, query_subvec, pq_codebooks_[m][c]);
            }
        }
    }

    std::vector<std::pair<long, float> > results;

    for (std::int64_t i = 0; i < std::min(nprobe_, static_cast<std::int64_t>(centroid_distances.size())); i++) {
        std::int64_t centroid_index = centroid_distances[i].first;

        for (long id: inverted_lists_[centroid_index]) {
            const auto& code = pq_codes_[id];

            // Use precomputed distance tables for fast distance approximation
            float approx_dist = 0.0f;
            for (std::int64_t m = 0; m < m_; m++) {
                approx_dist += distance_tables[m][code[m]];
            }

            // For L2, take sqrt of the sum of squared distances
            if (distance_metric_ == DistanceMetric::L2) {
                approx_dist = std::sqrt(approx_dist);
            }

            results.emplace_back(id, approx_dist);
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
    return IndexType::IVF_PQ;
}

// Called when setting a new vector store, called only once
bool IVFPQIndex::train(const std::vector<std::vector<float> > &training_data, std::int64_t n_iterations,
                     float tolerance, bool populate_inverted_lists) {
    if (dimension() % m_ != 0) {
        std::cerr << "ERROR: Dimension must be divisible by m" << std::endl;
        return false;
    }

    // IVF training
    if (training_data.empty() || training_data[0].size() != dimension()) {
        return false;
    }

    auto kmeans_result = kmeans(training_data, nlist_, n_iterations, tolerance, distance_metric_);
    centroids_ = std::move(kmeans_result.centroids);

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
    set_compressed_dim(dimension() / m_);

    for (std::int64_t i = 0; i < m_; i++) {
        std::vector<std::vector<float>> subspace_data;
        for (const auto& vec: training_data) {
            std::vector<float> subvector(vec.begin() + i * compressed_dim_, vec.begin() + (i + 1) * compressed_dim_);
            subspace_data.push_back(std::move(subvector));
        }

        auto pq_kmeans_result = kmeans(subspace_data, codebook_size_, n_iterations, tolerance, distance_metric_);
        pq_codebooks_.push_back(std::move(pq_kmeans_result.centroids));
    }

    for (auto& vec : training_data) {
        std::vector<std::uint8_t> code = encode_vector(vec);
        pq_codes_.push_back(std::move(code));
    }

    is_trained_ = true;
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
        set_compressed_dim(0);
        pq_codebooks_.clear();
        pq_codes_.clear();

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

        // Encode the vector using PQ codebooks
        std::vector<std::uint8_t> code = encode_vector(vector_store_->data_[i]);
        pq_codes_.push_back(std::move(code));
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
