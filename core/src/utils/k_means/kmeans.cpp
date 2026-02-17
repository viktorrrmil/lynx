//
// Created by viktor on 1/20/26.
//

#include "../include/lynx/utils/kmeans.h"

#include <random>
#include <unordered_set>
#include <algorithm>
#include <limits>

float squared_distance(const std::vector<float>& a, const std::vector<float>& b) {
    float sum = 0.0f;
    for (size_t i = 0; i < a.size(); i++) {
        float diff = a[i] - b[i];
        sum += diff * diff;
    }
    return sum;
}


float compute_distance_kmeans(DistanceMetric metric, const std::span<const float> &vector_a, const std::span<const float> &vector_b) {
    if (metric == DistanceMetric::COSINE) {
        return compute_distance(metric, vector_a, vector_b);
    }

    return squared_distance(std::vector<float>(vector_a.begin(), vector_a.end()), std::vector<float>(vector_b.begin(), vector_b.end()));
}


/* Computes a new centroid as the mean of the points in the cluster */
std::vector<float> compute_centroid(const std::vector<std::vector<float>>& cluster) {
    if (cluster.empty()) {
        return {};
    }

    size_t dimension = cluster[0].size();
    std::vector<float> centroid(dimension, 0.0f);

    for (const auto& point : cluster) {
        for (size_t i = 0; i < dimension; i++) {
            centroid[i] += point[i];
        }
    }

    for (size_t i = 0; i < dimension; i++) {
        centroid[i] /= static_cast<float>(cluster.size());
    }

    return centroid;
}

std::vector<std::vector<float>> kmeans_plusplus_init(
    const std::vector<std::vector<float>>& data,
    int k,
    std::mt19937& engine,
    DistanceMetric metric
) {
    std::vector<std::vector<float>> centroids;
    std::vector<float> min_distances(data.size(), std::numeric_limits<float>::max());

    std::uniform_int_distribution<size_t> first_dist(0, data.size() - 1);
    centroids.push_back(data[first_dist(engine)]);

    for (int c = 1; c < k; ++c) {
        float total_dist = 0.0f;
        for (size_t i = 0; i < data.size(); ++i) {
            float dist = compute_distance_kmeans(metric, data[i], centroids.back());
            min_distances[i] = std::min(min_distances[i], dist);
            total_dist += min_distances[i];
        }

        if (total_dist == 0.0f) {
            std::uniform_int_distribution<size_t> fallback_dist(0, data.size() - 1);
            centroids.push_back(data[fallback_dist(engine)]);
            continue;
        }

        std::uniform_real_distribution<float> sample_dist(0.0f, total_dist);
        float threshold = sample_dist(engine);
        float cumulative = 0.0f;

        for (size_t i = 0; i < data.size(); ++i) {
            cumulative += min_distances[i];
            if (cumulative >= threshold) {
                centroids.push_back(data[i]);
                break;
            }
        }

        if (static_cast<int>(centroids.size()) < c + 1) {
            centroids.push_back(data.back());
        }
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

    std::random_device rd;
    std::mt19937 engine(rd());

    std::vector<std::vector<float>> centroids = kmeans_plusplus_init(data, k, engine, metric);

    while (!converged && iterations < max_iterations) {
        std::vector<std::vector<std::vector<float>>> clusters(k);
        std::vector<float> max_distances(data.size(), 0.0f);

        for (int i = 0; i < data.size(); i++) {

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
            assignments[i] = closest_centroid;
            clusters[closest_centroid].push_back(point);
            max_distances[i] = min_distance;
        }

        std::vector<std::vector<float>> new_centroids;

        for (int i = 0; i < k; i++) {
            if (clusters[i].empty()) {
                size_t farthest_idx = 0;
                float max_dist = 0.0f;
                for (size_t j = 0; j < data.size(); j++) {
                    if (max_distances[j] > max_dist) {
                        max_dist = max_distances[j];
                        farthest_idx = j;
                    }
                }
                new_centroids.push_back(data[farthest_idx]);
                max_distances[farthest_idx] = 0.0f;
            } else {
                new_centroids.push_back(compute_centroid(clusters[i]));
            }
        }

        float shift = 0.0f;
        float centroid_magnitude = 0.0f;
        for (int i = 0; i < k; i++) {
            shift += compute_distance_kmeans(metric, new_centroids[i], centroids[i]);
            for (float val : centroids[i]) {
                centroid_magnitude += val * val;
            }
        }

        float relative_shift = (centroid_magnitude > 0.0f) ? (shift / centroid_magnitude) : shift;
        converged = relative_shift < tolerance;

        centroids = new_centroids;
        iterations++;
    }

    return {centroids, assignments, iterations, converged};
}
