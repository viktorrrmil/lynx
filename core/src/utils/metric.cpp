//
// Created by viktor on 12/18/25.
//

#include "../../include/lynx/utils/metric.h"

#include <cmath>
#include <iostream>
#include <limits>
#include <ostream>
#include <stdexcept>
#include <vector>

float l2_distance(const std::span<const float> &vector_a, const std::span<const float> &vector_b) {
    if (vector_a.size() != vector_b.size()) {
        throw std::invalid_argument("Vector size mismatch");
    }

    float sum = 0.0;

    for (size_t i = 0; i < vector_a.size(); i++) {
        float diff = vector_a[i] - vector_b[i];
        sum += diff * diff;
    }

    return std::sqrt(sum);
}

float cosine_distance(const std::span<const float> &vector_a, const std::span<const float> &vector_b) {
    if (vector_a.size() != vector_b.size())
        throw std::invalid_argument("Vector size mismatch");

    float dot = 0.0f;
    float norm_a = 0.0f;
    float norm_b = 0.0f;

    for (size_t i = 0; i < vector_a.size(); i++) {
        dot += vector_a[i] * vector_b[i];
        norm_a += vector_a[i] * vector_a[i];
        norm_b += vector_b[i] * vector_b[i];
    }

    if (norm_a == 0.0f || norm_b == 0.0f)
        throw std::invalid_argument("Zero vector not allowed for cosine distance");

    float similarity = dot / (std::sqrt(norm_a) * std::sqrt(norm_b));
    similarity = std::max(-1.0f, std::min(1.0f, similarity));

    return 1.0f - similarity;
}

float compute_distance(DistanceMetric metric, const std::span<const float> &vector_a, const std::span<const float> &vector_b) {
    switch (metric) {
        case DistanceMetric::L2:
            return l2_distance(vector_a, vector_b);
        case DistanceMetric::COSINE:
            return cosine_distance(vector_a, vector_b);
        default:
            return std::numeric_limits<float>::infinity();
    }
}
