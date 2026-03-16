//
// Created by viktor on 3/16/26.
//

#include "lynx/training_time_utils.h"

#include <cmath>
#include <random>
#include <vector>

std::shared_ptr<InMemoryVectorStore> build_training_sample_store(
    int dimension,
    std::size_t sample_size,
    DistanceMetric metric
) {
    if (dimension <= 0 || sample_size == 0) {
        return nullptr;
    }

    auto store = std::make_shared<InMemoryVectorStore>();
    std::vector<std::vector<float>> vectors;
    vectors.reserve(sample_size);

    std::mt19937 rng(std::random_device{}());
    std::uniform_real_distribution<float> dist(-1.0f, 1.0f);

    for (std::size_t i = 0; i < sample_size; i++) {
        std::vector<float> vec;
        vec.reserve(static_cast<std::size_t>(dimension));

        float norm_sq = 0.0f;
        for (int d = 0; d < dimension; d++) {
            float value = dist(rng);
            vec.push_back(value);
            norm_sq += value * value;
        }

        if (metric == DistanceMetric::COSINE && norm_sq > 0.0f) {
            float inv_norm = 1.0f / std::sqrt(norm_sq);
            for (auto &value : vec) {
                value *= inv_norm;
            }
        }

        vectors.push_back(std::move(vec));
    }

    if (!store->add_batch(vectors)) {
        return nullptr;
    }

    return store;
}
