//
// Created by viktor on 2/20/26.
//

#include <gtest/gtest.h>
#include "lynx/bruteforce_index.h"
#include "lynx/in_memory_vector_store.h"

class BruteForceIndexTest : public ::testing::Test {
protected:
    BruteForceIndex index;
    std::shared_ptr<InMemoryVectorStore> store;

    void SetUp() override {
        store = std::make_shared<InMemoryVectorStore>();
    }

    void PopulateStore() {
        store->add_vector({1.0f, 0.0f, 0.0f});
        store->add_vector({0.0f, 1.0f, 0.0f});
        store->add_vector({0.0f, 0.0f, 1.0f});
        store->add_vector({1.0f, 1.0f, 0.0f});
        store->add_vector({0.5f, 0.5f, 0.5f});
        index.set_vector_store(store);
    }
};

// ==================== INITIALIZATION TESTS ====================

TEST_F(BruteForceIndexTest, IsNotInitializedByDefault) {
    EXPECT_FALSE(index.is_initialized());
}

TEST_F(BruteForceIndexTest, IsInitializedAfterSetVectorStore) {
    index.set_vector_store(store);
    EXPECT_TRUE(index.is_initialized());
}

// ==================== SET_VECTOR_STORE TESTS ====================

TEST_F(BruteForceIndexTest, SetVectorStoreReturnsTrueForValidStore) {
    EXPECT_TRUE(index.set_vector_store(store));
}

TEST_F(BruteForceIndexTest, SetVectorStoreReturnsFalseForNullptr) {
    EXPECT_FALSE(index.set_vector_store(nullptr));
}

// ==================== SIZE AND DIMENSION TESTS ====================

TEST_F(BruteForceIndexTest, SizeIsZeroWithoutVectorStore) {
    EXPECT_EQ(index.size(), 0);
}

TEST_F(BruteForceIndexTest, DimensionIsZeroWithoutVectorStore) {
    EXPECT_EQ(index.dimension(), 0);
}

TEST_F(BruteForceIndexTest, SizeMatchesVectorStore) {
    PopulateStore();
    EXPECT_EQ(index.size(), 5);
}

TEST_F(BruteForceIndexTest, DimensionMatchesVectorStore) {
    PopulateStore();
    EXPECT_EQ(index.dimension(), 3);
}

// ==================== SEARCH TESTS ====================

TEST_F(BruteForceIndexTest, SearchReturnsEmptyWithoutVectorStore) {
    std::vector<float> query = {1.0f, 0.0f, 0.0f};
    auto results = index.search(query, 1);
    EXPECT_TRUE(results.empty());
}

TEST_F(BruteForceIndexTest, SearchReturnsEmptyWithEmptyQuery) {
    PopulateStore();
    std::vector<float> query;
    auto results = index.search(query, 1);
    EXPECT_TRUE(results.empty());
}

TEST_F(BruteForceIndexTest, SearchReturnsEmptyWithKZero) {
    PopulateStore();
    std::vector<float> query = {1.0f, 0.0f, 0.0f};
    auto results = index.search(query, 0);
    EXPECT_TRUE(results.empty());
}

TEST_F(BruteForceIndexTest, SearchReturnsEmptyWithNegativeK) {
    PopulateStore();
    std::vector<float> query = {1.0f, 0.0f, 0.0f};
    auto results = index.search(query, -1);
    EXPECT_TRUE(results.empty());
}

TEST_F(BruteForceIndexTest, SearchReturnsEmptyWithDimensionMismatch) {
    PopulateStore();
    std::vector<float> query = {1.0f, 0.0f}; // 2D query for 3D store
    auto results = index.search(query, 1);
    EXPECT_TRUE(results.empty());
}

TEST_F(BruteForceIndexTest, SearchReturnsExactMatchFirst) {
    PopulateStore();
    std::vector<float> query = {1.0f, 0.0f, 0.0f};
    auto results = index.search(query, 1);

    ASSERT_EQ(results.size(), 1);
    EXPECT_EQ(results[0].first, 0);  // First vector is exact match
    EXPECT_FLOAT_EQ(results[0].second, 0.0f);
}

TEST_F(BruteForceIndexTest, SearchReturnsKResults) {
    PopulateStore();
    std::vector<float> query = {0.5f, 0.5f, 0.5f};
    auto results = index.search(query, 3);

    EXPECT_EQ(results.size(), 3);
}

TEST_F(BruteForceIndexTest, SearchResultsAreSortedByDistance) {
    PopulateStore();
    std::vector<float> query = {1.0f, 1.0f, 0.0f};
    auto results = index.search(query, 5);

    for (size_t i = 1; i < results.size(); ++i) {
        EXPECT_LE(results[i - 1].second, results[i].second);
    }
}

TEST_F(BruteForceIndexTest, SearchReturnsAllWhenKExceedsSize) {
    PopulateStore();
    std::vector<float> query = {1.0f, 0.0f, 0.0f};
    auto results = index.search(query, 100);

    EXPECT_EQ(results.size(), 5);
}

TEST_F(BruteForceIndexTest, SearchWithL2Distance) {
    store->add_vector({0.0f, 0.0f, 0.0f});
    store->add_vector({3.0f, 4.0f, 0.0f}); // L2 distance = 5 from origin
    index.set_vector_store(store);
    index.set_distance_metric(DistanceMetric::L2);

    std::vector<float> query = {0.0f, 0.0f, 0.0f};
    auto results = index.search(query, 2);

    ASSERT_EQ(results.size(), 2);
    EXPECT_FLOAT_EQ(results[0].second, 0.0f);
    EXPECT_FLOAT_EQ(results[1].second, 5.0f);
}

TEST_F(BruteForceIndexTest, SearchWithCosineDistance) {
    BruteForceIndex cosine_index(DistanceMetric::COSINE);
    store->add_vector({1.0f, 0.0f, 0.0f});
    store->add_vector({-1.0f, 0.0f, 0.0f}); // Opposite direction
    cosine_index.set_vector_store(store);

    std::vector<float> query = {1.0f, 0.0f, 0.0f};
    auto results = cosine_index.search(query, 2);

    ASSERT_EQ(results.size(), 2);
    EXPECT_EQ(results[0].first, 0); // Same direction should be closest
}

TEST_F(BruteForceIndexTest, SearchWithChangedTopK) {
    PopulateStore();
    std::vector<float> query = {0.5f, 0.5f, 0.5f};

    auto results_k2 = index.search(query, 2);
    EXPECT_EQ(results_k2.size(), 2);

    auto results_k4 = index.search(query, 4);
    EXPECT_EQ(results_k4.size(), 4);

    for (int i = 0; i < 2; ++i) {
        EXPECT_EQ(results_k2[i].first, results_k4[i].first);
        EXPECT_FLOAT_EQ(results_k2[i].second, results_k4[i].second);
    }
}
