//
// Created by viktor on 12/24/25.
//

#include <gtest/gtest.h>
#include "lynx/bruteforce_index.h"
#include "lynx/utils/metric.h"

TEST(DistanceTest, L2DistanceZero) {
    BruteForceIndex index(3, DistanceMetric::L2);
    index.add_vector(1, {1.0f, 2.0f, 3.0f});

    auto results = index.search({1.0f, 2.0f, 3.0f}, 1);

    ASSERT_EQ(results.size(), 1);
    ASSERT_EQ(results[0].first, 1);
    ASSERT_FLOAT_EQ(results[0].second, 0.0f);
}