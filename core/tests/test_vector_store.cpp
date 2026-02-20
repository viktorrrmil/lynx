//
// Created by viktor on 2/20/26.
//

#include <gtest/gtest.h>
#include "lynx/in_memory_vector_store.h"

class InMemoryVectorStoreTest : public ::testing::Test {
protected:
    InMemoryVectorStore store;
};

// ==================== SIZE TESTS ====================

TEST_F(InMemoryVectorStoreTest, InitialSizeIsZero) {
    EXPECT_EQ(store.size(), 0);
}

TEST_F(InMemoryVectorStoreTest, SizeIncreasesAfterAddingVectors) {
    store.add_vector({1.0f, 2.0f, 3.0f});
    EXPECT_EQ(store.size(), 1);

    store.add_vector({4.0f, 5.0f, 6.0f});
    EXPECT_EQ(store.size(), 2);

    store.add_vector({7.0f, 8.0f, 9.0f});
    EXPECT_EQ(store.size(), 3);
}

// ==================== DIMENSION TESTS ====================

TEST_F(InMemoryVectorStoreTest, DimensionIsZeroWhenEmpty) {
    EXPECT_EQ(store.dimension(), 0);
}

TEST_F(InMemoryVectorStoreTest, DimensionInferredFromFirstVector) {
    store.add_vector({1.0f, 2.0f, 3.0f});
    EXPECT_EQ(store.dimension(), 3);
}

TEST_F(InMemoryVectorStoreTest, DimensionRemainsConstant) {
    store.add_vector({1.0f, 2.0f, 3.0f, 4.0f, 5.0f});
    EXPECT_EQ(store.dimension(), 5);

    store.add_vector({6.0f, 7.0f, 8.0f, 9.0f, 10.0f});
    EXPECT_EQ(store.dimension(), 5);
}

TEST_F(InMemoryVectorStoreTest, DimensionWorksWithSingleDimension) {
    store.add_vector({42.0f});
    EXPECT_EQ(store.dimension(), 1);
}

TEST_F(InMemoryVectorStoreTest, DimensionWorksWithHighDimension) {
    std::vector<float> high_dim_vector(1024, 1.0f);
    store.add_vector(high_dim_vector);
    EXPECT_EQ(store.dimension(), 1024);
}

// ==================== ADD_VECTOR TESTS ====================

TEST_F(InMemoryVectorStoreTest, AddVectorReturnsTrueOnSuccess) {
    EXPECT_TRUE(store.add_vector({1.0f, 2.0f, 3.0f}));
}

TEST_F(InMemoryVectorStoreTest, AddVectorReturnsTrueForMatchingDimension) {
    store.add_vector({1.0f, 2.0f, 3.0f});
    EXPECT_TRUE(store.add_vector({4.0f, 5.0f, 6.0f}));
}

TEST_F(InMemoryVectorStoreTest, AddVectorReturnsFalseForMismatchedDimension) {
    store.add_vector({1.0f, 2.0f, 3.0f});
    EXPECT_FALSE(store.add_vector({4.0f, 5.0f}));
    EXPECT_FALSE(store.add_vector({4.0f, 5.0f, 6.0f, 7.0f}));
}

TEST_F(InMemoryVectorStoreTest, MismatchedDimensionDoesNotIncreaseSize) {
    store.add_vector({1.0f, 2.0f, 3.0f});
    store.add_vector({4.0f, 5.0f}); // Should fail
    EXPECT_EQ(store.size(), 1);
}

TEST_F(InMemoryVectorStoreTest, AddEmptyVectorWhenStoreIsEmpty) {
    EXPECT_TRUE(store.add_vector({}));
    EXPECT_EQ(store.size(), 1);
    EXPECT_EQ(store.dimension(), 0);
}

TEST_F(InMemoryVectorStoreTest, AddVectorPreservesValues) {
    std::vector<float> original = {1.5f, 2.5f, 3.5f};
    store.add_vector(original);

    auto retrieved = store.get_vector(0);
    EXPECT_EQ(retrieved.size(), 3);
    EXPECT_FLOAT_EQ(retrieved[0], 1.5f);
    EXPECT_FLOAT_EQ(retrieved[1], 2.5f);
    EXPECT_FLOAT_EQ(retrieved[2], 3.5f);
}

// ==================== GET_VECTOR TESTS ====================

TEST_F(InMemoryVectorStoreTest, GetVectorReturnsCorrectVector) {
    store.add_vector({1.0f, 2.0f, 3.0f});
    store.add_vector({4.0f, 5.0f, 6.0f});
    store.add_vector({7.0f, 8.0f, 9.0f});

    auto vec0 = store.get_vector(0);
    EXPECT_FLOAT_EQ(vec0[0], 1.0f);
    EXPECT_FLOAT_EQ(vec0[1], 2.0f);
    EXPECT_FLOAT_EQ(vec0[2], 3.0f);

    auto vec1 = store.get_vector(1);
    EXPECT_FLOAT_EQ(vec1[0], 4.0f);
    EXPECT_FLOAT_EQ(vec1[1], 5.0f);
    EXPECT_FLOAT_EQ(vec1[2], 6.0f);

    auto vec2 = store.get_vector(2);
    EXPECT_FLOAT_EQ(vec2[0], 7.0f);
    EXPECT_FLOAT_EQ(vec2[1], 8.0f);
    EXPECT_FLOAT_EQ(vec2[2], 9.0f);
}

TEST_F(InMemoryVectorStoreTest, GetVectorReturnsCorrectSize) {
    store.add_vector({1.0f, 2.0f, 3.0f, 4.0f, 5.0f});
    auto vec = store.get_vector(0);
    EXPECT_EQ(vec.size(), 5);
}

TEST_F(InMemoryVectorStoreTest, GetVectorThrowsOutOfRange) {
    EXPECT_THROW(store.get_vector(0), std::out_of_range);

    store.add_vector({1.0f, 2.0f, 3.0f});
    EXPECT_THROW(store.get_vector(1), std::out_of_range);
    EXPECT_THROW(store.get_vector(100), std::out_of_range);
}

TEST_F(InMemoryVectorStoreTest, GetVectorDoesNotThrowForValidIndex) {
    store.add_vector({1.0f, 2.0f, 3.0f});
    store.add_vector({4.0f, 5.0f, 6.0f});

    EXPECT_NO_THROW(store.get_vector(0));
    EXPECT_NO_THROW(store.get_vector(1));
}

// ==================== GET_ALL_VECTORS TESTS ====================

TEST_F(InMemoryVectorStoreTest, GetAllVectorsReturnsEmptyWhenEmpty) {
    auto all = store.get_all_vectors();
    EXPECT_TRUE(all.empty());
}

TEST_F(InMemoryVectorStoreTest, GetAllVectorsReturnsAllVectors) {
    store.add_vector({1.0f, 2.0f});
    store.add_vector({3.0f, 4.0f});
    store.add_vector({5.0f, 6.0f});

    auto all = store.get_all_vectors();
    EXPECT_EQ(all.size(), 3);

    EXPECT_FLOAT_EQ(all[0][0], 1.0f);
    EXPECT_FLOAT_EQ(all[0][1], 2.0f);
    EXPECT_FLOAT_EQ(all[1][0], 3.0f);
    EXPECT_FLOAT_EQ(all[1][1], 4.0f);
    EXPECT_FLOAT_EQ(all[2][0], 5.0f);
    EXPECT_FLOAT_EQ(all[2][1], 6.0f);
}

TEST_F(InMemoryVectorStoreTest, GetAllVectorsReturnsACopy) {
    store.add_vector({1.0f, 2.0f, 3.0f});

    auto all = store.get_all_vectors();
    all[0][0] = 999.0f;

    auto vec = store.get_vector(0);
    EXPECT_FLOAT_EQ(vec[0], 1.0f); // Original unchanged
}

// ==================== ADD_BATCH TESTS ====================

TEST_F(InMemoryVectorStoreTest, AddBatchAddsMultipleVectors) {
    std::vector<std::vector<float>> batch = {
        {1.0f, 2.0f, 3.0f},
        {4.0f, 5.0f, 6.0f},
        {7.0f, 8.0f, 9.0f}
    };

    EXPECT_TRUE(store.add_batch(batch));
    EXPECT_EQ(store.size(), 3);
}

TEST_F(InMemoryVectorStoreTest, AddBatchReturnsFalseOnDimensionMismatch) {
    store.add_vector({1.0f, 2.0f, 3.0f});

    std::vector<std::vector<float>> batch = {
        {4.0f, 5.0f, 6.0f},
        {7.0f, 8.0f}  // Wrong dimension
    };

    EXPECT_FALSE(store.add_batch(batch));
}

TEST_F(InMemoryVectorStoreTest, AddBatchWithEmptyBatch) {
    std::vector<std::vector<float>> empty_batch;
    EXPECT_TRUE(store.add_batch(empty_batch));
    EXPECT_EQ(store.size(), 0);
}

TEST_F(InMemoryVectorStoreTest, AddBatchPreservesOrder) {
    std::vector<std::vector<float>> batch = {
        {1.0f, 0.0f},
        {2.0f, 0.0f},
        {3.0f, 0.0f}
    };

    store.add_batch(batch);

    EXPECT_FLOAT_EQ(store.get_vector(0)[0], 1.0f);
    EXPECT_FLOAT_EQ(store.get_vector(1)[0], 2.0f);
    EXPECT_FLOAT_EQ(store.get_vector(2)[0], 3.0f);
}

// ==================== EDGE CASES ====================

TEST_F(InMemoryVectorStoreTest, HandlesLargeNumberOfVectors) {
    const int num_vectors = 10000;
    const int dim = 128;

    for (int i = 0; i < num_vectors; ++i) {
        std::vector<float> vec(dim, static_cast<float>(i));
        EXPECT_TRUE(store.add_vector(vec));
    }

    EXPECT_EQ(store.size(), num_vectors);
    EXPECT_EQ(store.dimension(), dim);

    // Verify first and last vectors
    auto first = store.get_vector(0);
    EXPECT_FLOAT_EQ(first[0], 0.0f);

    auto last = store.get_vector(num_vectors - 1);
    EXPECT_FLOAT_EQ(last[0], static_cast<float>(num_vectors - 1));
}

TEST_F(InMemoryVectorStoreTest, HandlesFloatSpecialValues) {
    store.add_vector({0.0f, -0.0f, 1e-38f, 1e38f});

    auto vec = store.get_vector(0);
    EXPECT_FLOAT_EQ(vec[0], 0.0f);
    EXPECT_FLOAT_EQ(vec[1], -0.0f);
    EXPECT_FLOAT_EQ(vec[2], 1e-38f);
    EXPECT_FLOAT_EQ(vec[3], 1e38f);
}

TEST_F(InMemoryVectorStoreTest, HandlesNegativeValues) {
    store.add_vector({-1.0f, -2.5f, -100.0f});

    auto vec = store.get_vector(0);
    EXPECT_FLOAT_EQ(vec[0], -1.0f);
    EXPECT_FLOAT_EQ(vec[1], -2.5f);
    EXPECT_FLOAT_EQ(vec[2], -100.0f);
}

TEST_F(InMemoryVectorStoreTest, MultipleStoresAreIndependent) {
    InMemoryVectorStore store1;
    InMemoryVectorStore store2;

    store1.add_vector({1.0f, 2.0f, 3.0f});
    store2.add_vector({4.0f, 5.0f});

    EXPECT_EQ(store1.size(), 1);
    EXPECT_EQ(store1.dimension(), 3);

    EXPECT_EQ(store2.size(), 1);
    EXPECT_EQ(store2.dimension(), 2);
}
