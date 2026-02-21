//
// Created by viktor on 2/20/26.
//

#include <gtest/gtest.h>
#include "lynx/ivf_index.h"
#include "lynx/in_memory_vector_store.h"

class IVFIndexTest : public ::testing::Test {
protected:
    std::shared_ptr<InMemoryVectorStore> store;
    static constexpr int64_t NLIST = 4;
    static constexpr int64_t NPROBE = 2;

    void SetUp() override {
        store = std::make_shared<InMemoryVectorStore>();
    }

    void PopulateStore(int count = 100, int dim = 8) {
        for (int i = 0; i < count; i++) {
            std::vector<float> vec(dim);
            for (int j = 0; j < dim; j++) {
                vec[j] = static_cast<float>(i * dim + j) / (count * dim);
            }
            store->add_vector(vec);
        }
    }

    std::vector<std::vector<float>> GenerateClusteredData(int clusters, int per_cluster, int dim) {
        std::vector<std::vector<float>> data;
        for (int c = 0; c < clusters; c++) {
            float offset = static_cast<float>(c) * 10.0f;
            for (int i = 0; i < per_cluster; i++) {
                std::vector<float> vec(dim);
                for (int j = 0; j < dim; j++) {
                    vec[j] = offset + static_cast<float>(i) * 0.01f;
                }
                data.push_back(vec);
            }
        }
        return data;
    }
};

// ==================== INITIALIZATION TESTS ====================

TEST_F(IVFIndexTest, DefaultConstructor) {
    IVFIndex index;
    EXPECT_EQ(index.distance_metric(), DistanceMetric::L2);
}

TEST_F(IVFIndexTest, ConstructorWithParameters) {
    IVFIndex index(DistanceMetric::COSINE, NLIST, NPROBE);
    EXPECT_EQ(index.distance_metric(), DistanceMetric::COSINE);
    EXPECT_EQ(index.nlist(), NLIST);
    EXPECT_EQ(index.nprobe(), NPROBE);
}

TEST_F(IVFIndexTest, SetDistanceMetric) {
    IVFIndex index(DistanceMetric::L2, NLIST, NPROBE);
    index.set_distance_metric(DistanceMetric::COSINE);
    EXPECT_EQ(index.distance_metric(), DistanceMetric::COSINE);
}

TEST_F(IVFIndexTest, SetNprobe) {
    IVFIndex index(DistanceMetric::L2, NLIST, NPROBE);
    index.set_nprobe(5);
    EXPECT_EQ(index.nprobe(), 5);
}

TEST_F(IVFIndexTest, IsNotInitializedByDefault) {
    IVFIndex index(DistanceMetric::L2, NLIST, NPROBE);
    EXPECT_FALSE(index.is_initialized());
}

// ==================== SET_VECTOR_STORE TESTS ====================

TEST_F(IVFIndexTest, SetVectorStoreReturnsTrueForValidStore) {
    IVFIndex index(DistanceMetric::L2, NLIST, NPROBE);
    PopulateStore(50, 4);
    EXPECT_TRUE(index.set_vector_store(store));
}

TEST_F(IVFIndexTest, SetVectorStoreReturnsFalseForNullptr) {
    IVFIndex index(DistanceMetric::L2, NLIST, NPROBE);
    EXPECT_FALSE(index.set_vector_store(nullptr));
}

TEST_F(IVFIndexTest, SetVectorStoreTrainsAutomatically) {
    IVFIndex index(DistanceMetric::L2, NLIST, NPROBE);
    PopulateStore(50, 4);
    index.set_vector_store(store);
    EXPECT_TRUE(index.is_initialized());
}

TEST_F(IVFIndexTest, SetEmptyVectorStoreDoesNotTrain) {
    IVFIndex index(DistanceMetric::L2, NLIST, NPROBE);
    index.set_vector_store(store); // Empty store
    EXPECT_FALSE(index.is_initialized());
}

// ==================== SIZE AND DIMENSION TESTS ====================

TEST_F(IVFIndexTest, SizeIsZeroWithoutVectorStore) {
    IVFIndex index(DistanceMetric::L2, NLIST, NPROBE);
    EXPECT_EQ(index.size(), 0);
}

TEST_F(IVFIndexTest, DimensionIsZeroWithoutVectorStore) {
    IVFIndex index(DistanceMetric::L2, NLIST, NPROBE);
    EXPECT_EQ(index.dimension(), 0);
}

TEST_F(IVFIndexTest, SizeMatchesVectorStore) {
    IVFIndex index(DistanceMetric::L2, NLIST, NPROBE);
    PopulateStore(50, 4);
    index.set_vector_store(store);
    EXPECT_EQ(index.size(), 50);
    EXPECT_EQ(index.dimension(), 4);
}

// ==================== TRAIN TESTS ====================

TEST_F(IVFIndexTest, TrainReturnsFalseForEmptyData) {
    IVFIndex index(DistanceMetric::L2, NLIST, NPROBE);
    PopulateStore(50, 4);
    index.set_vector_store(store);
    std::vector<std::vector<float>> empty_data;
    EXPECT_FALSE(index.train(empty_data));
}

TEST_F(IVFIndexTest, TrainReturnsFalseForDimensionMismatch) {
    IVFIndex index(DistanceMetric::L2, NLIST, NPROBE);
    PopulateStore(50, 4);
    index.set_vector_store(store);
    std::vector<std::vector<float>> wrong_dim_data = {{1.0f, 2.0f}}; // 2D instead of 4D
    EXPECT_FALSE(index.train(wrong_dim_data));
}

TEST_F(IVFIndexTest, TrainSucceedsWithValidData) {
    IVFIndex index(DistanceMetric::L2, NLIST, NPROBE);
    PopulateStore(50, 4);
    index.set_vector_store(store);
    auto training_data = GenerateClusteredData(4, 20, 4);
    EXPECT_TRUE(index.train(training_data, 10, 1e-4, true));
}

// ==================== UPDATE_VECTORS TESTS ====================

TEST_F(IVFIndexTest, UpdateVectorsReturnsFalseWithoutVectorStore) {
    IVFIndex index(DistanceMetric::L2, NLIST, NPROBE);
    EXPECT_FALSE(index.update_vectors());
}

TEST_F(IVFIndexTest, UpdateVectorsSucceedsAfterTraining) {
    IVFIndex index(DistanceMetric::L2, NLIST, NPROBE);
    PopulateStore(50, 4);
    index.set_vector_store(store);
    EXPECT_TRUE(index.update_vectors());
}

TEST_F(IVFIndexTest, UpdateVectorsHandlesNewVectors) {
    IVFIndex index(DistanceMetric::L2, NLIST, NPROBE);
    PopulateStore(50, 4);
    index.set_vector_store(store);

    // Add new vectors
    store->add_vector({0.1f, 0.2f, 0.3f, 0.4f});
    store->add_vector({0.5f, 0.6f, 0.7f, 0.8f});

    EXPECT_TRUE(index.update_vectors());
    EXPECT_EQ(index.size(), 52);
}

// ==================== SEARCH TESTS ====================

TEST_F(IVFIndexTest, SearchReturnsEmptyWhenNotTrained) {
    IVFIndex index(DistanceMetric::L2, NLIST, NPROBE);
    std::vector<float> query = {1.0f, 0.0f, 0.0f, 0.0f};
    auto results = index.search(query, 1);
    EXPECT_TRUE(results.empty());
}

TEST_F(IVFIndexTest, SearchReturnsResults) {
    IVFIndex index(DistanceMetric::L2, NLIST, NPROBE);
    PopulateStore(50, 4);
    index.set_vector_store(store);

    std::vector<float> query = {0.1f, 0.1f, 0.1f, 0.1f};
    auto results = index.search(query, 5);

    EXPECT_LE(results.size(), 5);
    EXPECT_GT(results.size(), 0);
}

TEST_F(IVFIndexTest, SearchReturnsKResults) {
    IVFIndex index(DistanceMetric::L2, NLIST, NPROBE);
    PopulateStore(100, 4);
    index.set_vector_store(store);

    std::vector<float> query = {0.5f, 0.5f, 0.5f, 0.5f};
    auto results = index.search(query, 10);

    EXPECT_LE(results.size(), 10);
}

TEST_F(IVFIndexTest, SearchResultsAreSortedByDistance) {
    IVFIndex index(DistanceMetric::L2, NLIST, NPROBE);
    PopulateStore(100, 4);
    index.set_vector_store(store);

    std::vector<float> query = {0.5f, 0.5f, 0.5f, 0.5f};
    auto results = index.search(query, 20);

    for (size_t i = 1; i < results.size(); ++i) {
        EXPECT_LE(results[i - 1].second, results[i].second);
    }
}

TEST_F(IVFIndexTest, HigherNprobeSearchesMoreClusters) {
    IVFIndex index1(DistanceMetric::L2, NLIST, 1);
    IVFIndex index2(DistanceMetric::L2, NLIST, NLIST); // Search all clusters

    PopulateStore(100, 4);
    index1.set_vector_store(store);

    auto store2 = std::make_shared<InMemoryVectorStore>();
    for (size_t i = 0; i < store->size(); i++) {
        auto vec = store->get_vector(i);
        store2->add_vector(std::vector<float>(vec.begin(), vec.end()));
    }
    index2.set_vector_store(store2);

    std::vector<float> query = {0.5f, 0.5f, 0.5f, 0.5f};
    auto results1 = index1.search(query, 50);
    auto results2 = index2.search(query, 50);

    // Higher nprobe should search more vectors and potentially return more results
    EXPECT_GE(results2.size(), results1.size());
}

TEST_F(IVFIndexTest, SearchWithCosineDistance) {
    IVFIndex index(DistanceMetric::COSINE, NLIST, NPROBE);
    PopulateStore(50, 4);
    index.set_vector_store(store);

    std::vector<float> query = {1.0f, 1.0f, 1.0f, 1.0f};
    auto results = index.search(query, 5);

    EXPECT_GT(results.size(), 0);
}
