//
// Created by viktor on 1/20/26.
//

#include "../include/lynx/utils/kmeans.h"

#include <random>
#include <algorithm>
#include <limits>
#include <cmath>

#ifdef _OPENMP
#include <omp.h>
#endif

inline float squared_distance_fast(const std::vector<float>& a, const std::vector<float>& b) {
    float sum = 0.0f;
    const size_t n = a.size();
    for (size_t i = 0; i < n; i++) {
        float diff = a[i] - b[i];
        sum += diff * diff;
    }
    return sum;
}

inline float cosine_distance_fast(const std::vector<float>& a, const std::vector<float>& b) {
    float dot = 0.0f, norm_a = 0.0f, norm_b = 0.0f;
    const size_t n = a.size();
    for (size_t i = 0; i < n; i++) {
        dot += a[i] * b[i];
        norm_a += a[i] * a[i];
        norm_b += b[i] * b[i];
    }
    if (norm_a == 0.0f || norm_b == 0.0f) return 1.0f;
    float similarity = dot / (std::sqrt(norm_a) * std::sqrt(norm_b));
    return 1.0f - std::max(-1.0f, std::min(1.0f, similarity));
}

inline float compute_distance_kmeans(DistanceMetric metric, const std::vector<float>& a, const std::vector<float>& b) {
    if (metric == DistanceMetric::COSINE) {
        return cosine_distance_fast(a, b);
    }
    return squared_distance_fast(a, b);
}


std::vector<std::vector<float>> kmeans_plusplus_init(
    const std::vector<std::vector<float>>& data,
    int k,
    std::mt19937& engine,
    DistanceMetric metric
) {
    std::vector<std::vector<float>> centroids;
    centroids.reserve(k);

    const size_t n = data.size();

    const size_t max_sample = std::min(static_cast<size_t>(10000), n / 10 + 1);
    const bool use_sampling = n > 1000;
    const size_t sample_size = use_sampling ? std::min(max_sample, n) : n;
    const size_t step = use_sampling ? (n / sample_size) : 1;

    std::vector<float> min_distances(n, std::numeric_limits<float>::max());

    std::uniform_int_distribution<size_t> first_dist(0, n - 1);
    centroids.push_back(data[first_dist(engine)]);

    for (int c = 1; c < k; ++c) {
        float total_dist = 0.0f;
        size_t best_idx = 0;
        float best_dist = 0.0f;

        for (size_t i = 0; i < n; i += step) {
            float dist = compute_distance_kmeans(metric, data[i], centroids.back());
            min_distances[i] = std::min(min_distances[i], dist);
            total_dist += min_distances[i];

            // Track the point with maximum min-distance (greedy fallback)
            if (min_distances[i] > best_dist) {
                best_dist = min_distances[i];
                best_idx = i;
            }
        }

        if (total_dist == 0.0f) {
            std::uniform_int_distribution<size_t> fallback_dist(0, n - 1);
            centroids.push_back(data[fallback_dist(engine)]);
            continue;
        }

        // Use greedy selection (pick farthest point) which is faster and nearly as good
        centroids.push_back(data[best_idx]);
    }

    return centroids;
}

KMeansResult kmeans(const std::vector<std::vector<float> > &data, int k, int max_iterations, float tolerance, DistanceMetric metric) {
    std::vector<int> assignments(data.size(), -1);
    int iterations = 0;
    bool converged = false;

    k = std::min(k, static_cast<int>(data.size()));

    if (k <= 0 || data.empty()) {
        return {{}, assignments, 0, true};
    }

    const size_t n = data.size();
    const size_t dim = data[0].size();

    std::random_device rd;
    std::mt19937 engine(rd());

    std::vector<std::vector<float>> centroids = kmeans_plusplus_init(data, k, engine, metric);

    // Pre-allocate centroid sums and counts to avoid repeated allocations
    std::vector<std::vector<float>> centroid_sums(k, std::vector<float>(dim, 0.0f));
    std::vector<size_t> cluster_counts(k, 0);
    std::vector<float> max_distances(n, 0.0f);

    size_t prev_changes = n;  // Track assignment changes for early termination

    while (!converged && iterations < max_iterations) {
        // Reset sums and counts
        for (int i = 0; i < k; i++) {
            std::fill(centroid_sums[i].begin(), centroid_sums[i].end(), 0.0f);
            cluster_counts[i] = 0;
        }

        size_t assignment_changes = 0;

#ifdef _OPENMP
        // Parallel version: each thread has local sums/counts, then reduce
        #pragma omp parallel
        {
            std::vector<std::vector<float>> local_sums(k, std::vector<float>(dim, 0.0f));
            std::vector<size_t> local_counts(k, 0);
            size_t local_changes = 0;

            #pragma omp for nowait
            for (size_t i = 0; i < n; i++) {
                const std::vector<float>& point = data[i];
                int closest_centroid = 0;
                float min_distance = compute_distance_kmeans(metric, point, centroids[0]);

                for (int j = 1; j < k; j++) {
                    float d = compute_distance_kmeans(metric, point, centroids[j]);
                    if (d < min_distance) {
                        min_distance = d;
                        closest_centroid = j;
                    }
                }

                if (assignments[i] != closest_centroid) {
                    local_changes++;
                }

                assignments[i] = closest_centroid;
                max_distances[i] = min_distance;
                local_counts[closest_centroid]++;

                for (size_t d = 0; d < dim; d++) {
                    local_sums[closest_centroid][d] += point[d];
                }
            }

            // Reduce local results to global
            #pragma omp critical
            {
                assignment_changes += local_changes;
                for (int i = 0; i < k; i++) {
                    cluster_counts[i] += local_counts[i];
                    for (size_t d = 0; d < dim; d++) {
                        centroid_sums[i][d] += local_sums[i][d];
                    }
                }
            }
        }
#else
        // Single-threaded version
        for (size_t i = 0; i < n; i++) {
            const std::vector<float>& point = data[i];
            int closest_centroid = 0;
            float min_distance = compute_distance_kmeans(metric, point, centroids[0]);

            for (int j = 1; j < k; j++) {
                float d = compute_distance_kmeans(metric, point, centroids[j]);
                if (d < min_distance) {
                    min_distance = d;
                    closest_centroid = j;
                }
            }

            if (assignments[i] != closest_centroid) {
                assignment_changes++;
            }

            assignments[i] = closest_centroid;
            max_distances[i] = min_distance;
            cluster_counts[closest_centroid]++;

            for (size_t d = 0; d < dim; d++) {
                centroid_sums[closest_centroid][d] += point[d];
            }
        }
#endif

        // Early termination: if less than 0.1% of points changed, we're converged
        if (assignment_changes < n / 1000 + 1) {
            converged = true;
        }

        // Also terminate if changes stopped decreasing significantly
        if (assignment_changes >= prev_changes && iterations > 3) {
            converged = true;
        }
        prev_changes = assignment_changes;

        // Compute new centroids directly into the existing vector (avoid allocation)
        for (int i = 0; i < k; i++) {
            if (cluster_counts[i] == 0) {
                // Reinitialize empty cluster with farthest point
                size_t farthest_idx = 0;
                float max_dist = 0.0f;
                for (size_t j = 0; j < n; j++) {
                    if (max_distances[j] > max_dist) {
                        max_dist = max_distances[j];
                        farthest_idx = j;
                    }
                }
                centroids[i] = data[farthest_idx];
                max_distances[farthest_idx] = 0.0f;
            } else {
                float inv_count = 1.0f / static_cast<float>(cluster_counts[i]);
                for (size_t d = 0; d < dim; d++) {
                    centroids[i][d] = centroid_sums[i][d] * inv_count;
                }
            }
        }

        iterations++;
    }

    return {centroids, assignments, iterations, converged};
}
