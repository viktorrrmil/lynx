//
// Created by viktor on 12/18/25.
//

#include "../../include/lynx/utils/metric.h"

#include <cmath>
#include <limits>
#include <vector>

float l2_distance(const std::vector<float> &vector_a, const std::vector<float> &vector_b) {
    float sum = 0.0;

    for (size_t i = 0; i < vector_a.size(); i++) {
        float diff = vector_a[i] - vector_b[i];
        sum += diff * diff;
    }

    return std::sqrt(sum);
}

float cosine_distance(const std::vector<float> &vector_a, const std::vector<float> &vector_b) {
    // WARNING: cosine_distance not implemented yet
    return 0;
}

float compute_distance(DistanceMetric metric, const std::vector<float> &vector_a, const std::vector<float> &vector_b) {
    switch (metric) {
        case DistanceMetric::L2:
            return l2_distance(vector_a, vector_b);
        case DistanceMetric::COSINE:
            return cosine_distance(vector_a, vector_b);
        default:
            return std::numeric_limits<float>::infinity();
    }
}
