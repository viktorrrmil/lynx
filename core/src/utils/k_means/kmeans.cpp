//
// Created by viktor on 1/20/26.
//

#include "kmeans.h"

#include <random>

float squared_distance(const std::vector<float>& a, const std::vector<float>& b) {
    float sum = 0.0f;
    for (size_t i = 0; i < a.size(); i++) {
        float diff = a[i] - b[i];
        sum += diff * diff;
    }
    return sum;
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
        centroid[i] /= cluster.size();
    }

    return centroid;
}

KMeansResult kmeans(const std::vector<std::vector<float> > &data, int k, int max_iterations, float tolerance) {
    std::vector<std::vector<float>> centroids;
    std::vector<int> assignments(data.size(), -1);
    int iterations = 0;
    bool converged = false;

    // k random initial centroids
    std::random_device rd;

    std::mt19937 engine(rd());
    std::uniform_int_distribution<size_t> dist(0, data.size() - 1);

    for (int i = 0; i < k; ++i) {
        centroids.push_back(data[dist(engine)]);
    }

    while (!converged && iterations < max_iterations) {
        std::vector<std::vector<std::vector<float>>> clusters(k);

        for (int i = 0; i < data.size(); i++) {

            const std::vector<float>& point = data[i];
            int closest_centroid = 0;
            float min_distance = squared_distance(point, centroids[0]);

            for (int j = 1; j < k; j++) {
                float d = squared_distance(point, centroids[j]);
                if (d < min_distance) {
                    min_distance = d;
                    closest_centroid = j;
                }
            }
            assignments[i] = closest_centroid;
            clusters[closest_centroid].push_back(point);
        }

        std::vector<std::vector<float>> new_centroids;

        for (int i = 0; i < k; i++) {
            if (clusters[i].empty()) {
                new_centroids.push_back(centroids[i]);
            } else {
                new_centroids.push_back(compute_centroid(clusters[i]));
            }
        }

        float shift = 0.0f;
        for (int i = 0; i < k; i++) {
            shift += squared_distance(new_centroids[i], centroids[i]);
        }

        converged = shift < tolerance;
        centroids = new_centroids;
        iterations++;
    }

    return {centroids, assignments, iterations, converged};
}
