//
// Created by viktor on 12/10/25.
//

#include "gtest/gtest.h"
#include "../include/lynx/bruteforce_index.h"
#include "lynx/utils/metric.h"

// Add and search returns the same vector
TEST(BruteForceIndexTest, SimpleAddAndSearch) {
    BruteForceIndex index(2, DistanceMetric::L2);
    EXPECT_TRUE(index.add_vector(1, {1.0f, 2.0f}));

    auto results = index.search({1.0f, 2.0f}, 1);
    ASSERT_EQ(results.size(), 1);
    EXPECT_EQ(results[0].first, 1);
    EXPECT_FLOAT_EQ(results[0].second, 0.0f); // Distance to itself
}

// Top-K returns correct amount of results
TEST(BruteForceIndexTest, TopKCorrentAmount) {
    BruteForceIndex index(2, DistanceMetric::L2);
    index.add_vector(1, {1.0f, 2.0f});
    index.add_vector(2, {2.0f, 3.0f});
    index.add_vector(3, {3.0f, 4.0f});
    index.add_vector(4, {4.0f, 5.0f});
    index.add_vector(5, {5.0f, 6.0f});

    auto results = index.search({1.0f, 2.0f}, 3);
    ASSERT_EQ(results.size(), 3);
}

// Results are sorted by distance
TEST(BruteFoceIndexTest, ResultsSortedByDistance) {
    BruteForceIndex index(2, DistanceMetric::L2);
    index.add_vector(1, {1.0f, 2.0f});
    index.add_vector(2, {2.0f, 3.0f});
    index.add_vector(3, {3.0f, 4.0f});
    index.add_vector(4, {4.0f, 5.0f});
    index.add_vector(5, {5.0f, 6.0f});

    auto results = index.search({1.0f, 2.0f}, 4);

    for (size_t i = 1; i < results.size(); i++) {
        EXPECT_LE(results[i - 1].second, results[i].second);
    }
}

// Different distance metrics give different ordering
TEST(BruteForceIndexTest, DifferentMetricsOrdering) {
    BruteForceIndex l2_index(2, DistanceMetric::L2);
    BruteForceIndex cosine_index(2, DistanceMetric::COSINE);

    l2_index.add_vector(1, {1.0f, 2.0f});
    l2_index.add_vector(2, {0.0f, 2.0f});
    l2_index.add_vector(3, {4.0f, 3.0f});

    cosine_index.add_vector(1, {1.0f, 2.0f});
    cosine_index.add_vector(2, {0.0f, 2.0f});
    cosine_index.add_vector(3, {4.0f, 3.0f});

    auto l2_results = l2_index.search({1.0f, 1.0f}, 2);
    auto cosine_results = cosine_index.search({1.0f, 1.0f}, 2);

    bool order_different = false;
    for (size_t i = 0; i < l2_results.size(); i++) {
        if (l2_results[i].first != cosine_results[i].first) {
            order_different = true;
            break;
        }
    }

    EXPECT_TRUE(order_different);

    bool distance_different = false;

    for (size_t i = 0; i < l2_results.size(); i++) {
        if (l2_results[i].second != cosine_results[i].second) {
            distance_different = true;
            break;
        }
    }

    EXPECT_TRUE(distance_different);
}

// Adding duplicate IDs should fail
TEST(BruteForceIndexTest, DuplicateIDNotAllowed) {
    BruteForceIndex index(2, DistanceMetric::L2);
    EXPECT_TRUE(index.add_vector(1, {1.0f, 2.0f}));
    EXPECT_FALSE(index.add_vector(1, {2.0f, 3.0f})); // Duplicate ID
}

// Identical vectors with different IDs
TEST(BruteForceIndexTest, IdenticalVectorsDifferentIDs) {
    BruteForceIndex index(2, DistanceMetric::L2);
    EXPECT_TRUE(index.add_vector(1, {1.0f, 2.0f}));
    EXPECT_TRUE(index.add_vector(2, {1.0f, 2.0f})); // Same vector, different ID

    auto results = index.search({1.0f, 2.0f}, 2);
    ASSERT_EQ(results.size(), 2);
    EXPECT_EQ(results[0].second, 0.0f);
    EXPECT_EQ(results[1].second, 0.0f);
}

// Dimension mismatch handling
TEST(BruteForceIndexTest, InvalidVectorDimension) {
    BruteForceIndex index(3, DistanceMetric::L2);
    EXPECT_FALSE(index.add_vector(1, {1.0f, 2.0f})); // Invalid dimension

    index.add_vector(2, {1.0f, 2.0f, 3.0f});
    auto results = index.search({1.0f, 2.0f}, 1); // Invalid query dimension
    EXPECT_TRUE(results.empty());
}

// Search on empty index
TEST(BruteForceIndexTest, SearchOnEmptyIndex) {
    BruteForceIndex index(2, DistanceMetric::L2);
    auto results = index.search({1.0f, 2.0f}, 1);
    EXPECT_TRUE(results.empty());
}