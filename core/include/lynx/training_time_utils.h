//
// Created by viktor on 3/16/26.
//

#ifndef LYNX_TRAINING_TIME_UTILS_H
#define LYNX_TRAINING_TIME_UTILS_H

#include <cstddef>
#include <memory>

#include "in_memory_vector_store.h"
#include "utils/metric.h"

constexpr std::size_t kTrainingSampleSize = 1000;

std::shared_ptr<InMemoryVectorStore> build_training_sample_store(
    int dimension,
    std::size_t sample_size,
    DistanceMetric metric
);

#endif //LYNX_TRAINING_TIME_UTILS_H
