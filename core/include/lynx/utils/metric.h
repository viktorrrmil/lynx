//
// Created by viktor on 12/18/25.
//

#ifndef LYNX_METRIC_H
#define LYNX_METRIC_H
#include <cstdint>
#include <span>
#include <vector>

enum class DistanceMetric : int64_t {
    L2 = 1,
    COSINE = 2
};

float l2_distance(const std::span<const float>& a, const std::span<const float>& b);

float cosine_distance(const std::span<const float>& a, const std::span<const float>& b);

float compute_distance(DistanceMetric metric, const std::span<const float>& vector_a, const std::span<const float>& vector_b);

#endif //LYNX_METRIC_H