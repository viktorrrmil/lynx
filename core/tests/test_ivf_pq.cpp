//
// Created by viktor on 2/27/26.
//

#include <gtest/gtest.h>
#include "lynx/ivf_pq_index.h"
#include "lynx/in_memory_vector_store.h"

class IVFPQIndexTest : public ::testing::Test {
protected:
    std::shared_ptr<InMemoryVectorStore> store;
    static constexpr int64_t NLIST = 4;
    static constexpr int64_t NPROBE = 2;
    static constexpr int64_t M = 2;           // Number of sub-spaces
    static constexpr int64_t CODEBOOK_SIZE = 8; // Centroids per sub-space

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

TEST_F(IVFPQIndexTest, DefaultConstructor) {
    IVFPQIndex index;
    EXPECT_EQ(index.distance_metric(), DistanceMetric::L2);
    EXPECT_EQ(index.m(), 0);
    EXPECT_EQ(index.codebook_size(), 0);
    EXPECT_EQ(index.compressed_dim(), 0);
}

TEST_F(IVFPQIndexTest, ConstructorWithParameters) {
    IVFPQIndex index(DistanceMetric::COSINE, NLIST, NPROBE, M, CODEBOOK_SIZE);
    EXPECT_EQ(index.distance_metric(), DistanceMetric::COSINE);
    EXPECT_EQ(index.nlist(), NLIST);
    EXPECT_EQ(index.nprobe(), NPROBE);
    EXPECT_EQ(index.m(), M);
    EXPECT_EQ(index.codebook_size(), CODEBOOK_SIZE);
}

TEST_F(IVFPQIndexTest, SetDistanceMetric) {
    IVFPQIndex index(DistanceMetric::L2, NLIST, NPROBE, M, CODEBOOK_SIZE);
    index.set_distance_metric(DistanceMetric::COSINE);
    EXPECT_EQ(index.distance_metric(), DistanceMetric::COSINE);
}

TEST_F(IVFPQIndexTest, SetNprobe) {
    IVFPQIndex index(DistanceMetric::L2, NLIST, NPROBE, M, CODEBOOK_SIZE);
    index.set_nprobe(5);
    EXPECT_EQ(index.nprobe(), 5);
}

TEST_F(IVFPQIndexTest, SetM) {
    IVFPQIndex index(DistanceMetric::L2, NLIST, NPROBE, M, CODEBOOK_SIZE);
    index.set_m(4);
    EXPECT_EQ(index.m(), 4);
}

TEST_F(IVFPQIndexTest, SetCodebookSize) {
    IVFPQIndex index(DistanceMetric::L2, NLIST, NPROBE, M, CODEBOOK_SIZE);
    index.set_codebook_size(16);
    EXPECT_EQ(index.codebook_size(), 16);
}

TEST_F(IVFPQIndexTest, IsNotInitializedByDefault) {
    IVFPQIndex index(DistanceMetric::L2, NLIST, NPROBE, M, CODEBOOK_SIZE);
    EXPECT_FALSE(index.is_initialized());
}

// ==================== SET_VECTOR_STORE TESTS ====================

TEST_F(IVFPQIndexTest, SetVectorStoreReturnsTrueForValidStore) {
    IVFPQIndex index(DistanceMetric::L2, NLIST, NPROBE, M, CODEBOOK_SIZE);
    PopulateStore(50, 8); // dim=8 so that m=2 gives compressed_dim=4
    EXPECT_TRUE(index.set_vector_store(store));
}

TEST_F(IVFPQIndexTest, SetVectorStoreReturnsFalseForNullptr) {
    IVFPQIndex index(DistanceMetric::L2, NLIST, NPROBE, M, CODEBOOK_SIZE);
    EXPECT_FALSE(index.set_vector_store(nullptr));
}

TEST_F(IVFPQIndexTest, SetVectorStoreTrainsAutomatically) {
    IVFPQIndex index(DistanceMetric::L2, NLIST, NPROBE, M, CODEBOOK_SIZE);
    PopulateStore(50, 8);
    index.set_vector_store(store);
    EXPECT_TRUE(index.is_initialized());
}

TEST_F(IVFPQIndexTest, SetEmptyVectorStoreDoesNotTrain) {
    IVFPQIndex index(DistanceMetric::L2, NLIST, NPROBE, M, CODEBOOK_SIZE);
    index.set_vector_store(store); // Empty store
    EXPECT_FALSE(index.is_initialized());
}

TEST_F(IVFPQIndexTest, CompressedDimIsSetAfterTraining) {
    IVFPQIndex index(DistanceMetric::L2, NLIST, NPROBE, M, CODEBOOK_SIZE);
    PopulateStore(50, 8); // dim=8, m=2, so compressed_dim should be 4
    index.set_vector_store(store);
    EXPECT_EQ(index.compressed_dim(), 4); // 8 / 2 = 4
}

// ==================== SIZE AND DIMENSION TESTS ====================

TEST_F(IVFPQIndexTest, SizeIsZeroWithoutVectorStore) {
    IVFPQIndex index(DistanceMetric::L2, NLIST, NPROBE, M, CODEBOOK_SIZE);
    EXPECT_EQ(index.size(), 0);
}

TEST_F(IVFPQIndexTest, DimensionIsZeroWithoutVectorStore) {
    IVFPQIndex index(DistanceMetric::L2, NLIST, NPROBE, M, CODEBOOK_SIZE);
    EXPECT_EQ(index.dimension(), 0);
}

TEST_F(IVFPQIndexTest, SizeMatchesVectorStore) {
    IVFPQIndex index(DistanceMetric::L2, NLIST, NPROBE, M, CODEBOOK_SIZE);
    PopulateStore(50, 8);
    index.set_vector_store(store);
    EXPECT_EQ(index.size(), 50);
    EXPECT_EQ(index.dimension(), 8);
}

// ==================== TRAIN TESTS ====================

TEST_F(IVFPQIndexTest, TrainReturnsFalseForEmptyData) {
    IVFPQIndex index(DistanceMetric::L2, NLIST, NPROBE, M, CODEBOOK_SIZE);
    PopulateStore(50, 8);
    index.set_vector_store(store);
    std::vector<std::vector<float>> empty_data;
    EXPECT_FALSE(index.train(empty_data));
}

TEST_F(IVFPQIndexTest, TrainReturnsFalseForDimensionMismatch) {
    IVFPQIndex index(DistanceMetric::L2, NLIST, NPROBE, M, CODEBOOK_SIZE);
    PopulateStore(50, 8);
    index.set_vector_store(store);
    std::vector<std::vector<float>> wrong_dim_data = {{1.0f, 2.0f}}; // 2D instead of 8D
    EXPECT_FALSE(index.train(wrong_dim_data));
}

TEST_F(IVFPQIndexTest, TrainSucceedsWithValidData) {
    IVFPQIndex index(DistanceMetric::L2, NLIST, NPROBE, M, CODEBOOK_SIZE);
    PopulateStore(50, 8);
    index.set_vector_store(store);
    auto training_data = GenerateClusteredData(4, 20, 8);
    EXPECT_TRUE(index.train(training_data, 10, 1e-4, true));
}

// ==================== UPDATE_VECTORS TESTS ====================

TEST_F(IVFPQIndexTest, UpdateVectorsReturnsFalseWithoutVectorStore) {
    IVFPQIndex index(DistanceMetric::L2, NLIST, NPROBE, M, CODEBOOK_SIZE);
    EXPECT_FALSE(index.update_vectors());
}

TEST_F(IVFPQIndexTest, UpdateVectorsSucceedsAfterTraining) {
    IVFPQIndex index(DistanceMetric::L2, NLIST, NPROBE, M, CODEBOOK_SIZE);
    PopulateStore(50, 8);
    index.set_vector_store(store);
    EXPECT_TRUE(index.update_vectors());
}

TEST_F(IVFPQIndexTest, UpdateVectorsHandlesNewVectors) {
    IVFPQIndex index(DistanceMetric::L2, NLIST, NPROBE, M, CODEBOOK_SIZE);
    PopulateStore(50, 8);
    index.set_vector_store(store);

    // Add new vectors
    store->add_vector({0.1f, 0.2f, 0.3f, 0.4f, 0.5f, 0.6f, 0.7f, 0.8f});
    store->add_vector({0.5f, 0.6f, 0.7f, 0.8f, 0.9f, 1.0f, 1.1f, 1.2f});

    EXPECT_TRUE(index.update_vectors());
    EXPECT_EQ(index.size(), 52);
}

// ==================== SEARCH TESTS ====================

TEST_F(IVFPQIndexTest, SearchReturnsEmptyWhenNotTrained) {
    IVFPQIndex index(DistanceMetric::L2, NLIST, NPROBE, M, CODEBOOK_SIZE);
    std::vector<float> query = {1.0f, 0.0f, 0.0f, 0.0f, 0.0f, 0.0f, 0.0f, 0.0f};
    auto results = index.search(query, 1);
    EXPECT_TRUE(results.empty());
}

TEST_F(IVFPQIndexTest, SearchReturnsResults) {
    IVFPQIndex index(DistanceMetric::L2, NLIST, NPROBE, M, CODEBOOK_SIZE);
    PopulateStore(50, 8);
    index.set_vector_store(store);

    std::vector<float> query = {0.1f, 0.1f, 0.1f, 0.1f, 0.1f, 0.1f, 0.1f, 0.1f};
    auto results = index.search(query, 5);

    EXPECT_LE(results.size(), 5);
    EXPECT_GT(results.size(), 0);
}

TEST_F(IVFPQIndexTest, SearchReturnsKResults) {
    IVFPQIndex index(DistanceMetric::L2, NLIST, NPROBE, M, CODEBOOK_SIZE);
    PopulateStore(100, 8);
    index.set_vector_store(store);

    std::vector<float> query = {0.5f, 0.5f, 0.5f, 0.5f, 0.5f, 0.5f, 0.5f, 0.5f};
    auto results = index.search(query, 10);

    EXPECT_LE(results.size(), 10);
}

TEST_F(IVFPQIndexTest, SearchResultsAreSortedByDistance) {
    IVFPQIndex index(DistanceMetric::L2, NLIST, NPROBE, M, CODEBOOK_SIZE);
    PopulateStore(100, 8);
    index.set_vector_store(store);

    std::vector<float> query = {0.5f, 0.5f, 0.5f, 0.5f, 0.5f, 0.5f, 0.5f, 0.5f};
    auto results = index.search(query, 20);

    for (size_t i = 1; i < results.size(); ++i) {
        EXPECT_LE(results[i - 1].second, results[i].second);
    }
}

TEST_F(IVFPQIndexTest, SearchWithCosineDistance) {
    IVFPQIndex index(DistanceMetric::COSINE, NLIST, NPROBE, M, CODEBOOK_SIZE);
    PopulateStore(50, 8);
    index.set_vector_store(store);

    std::vector<float> query = {1.0f, 1.0f, 1.0f, 1.0f, 1.0f, 1.0f, 1.0f, 1.0f};
    auto results = index.search(query, 5);

    EXPECT_GT(results.size(), 0);
}

// ==================== PQ-SPECIFIC TESTS ====================

TEST_F(IVFPQIndexTest, PQCompressionReducesMemory) {
    // This is more of a conceptual test - PQ codes should be much smaller than original vectors
    IVFPQIndex index(DistanceMetric::L2, NLIST, NPROBE, M, CODEBOOK_SIZE);
    PopulateStore(100, 8);
    index.set_vector_store(store);

    // With M=2 subspaces, each vector is encoded as 2 bytes (uint8_t per subspace)
    // Original: 100 * 8 * 4 = 3200 bytes
    // Compressed: 100 * 2 = 200 bytes
    // This is a 16x compression ratio
    EXPECT_EQ(index.m(), M);
    EXPECT_TRUE(index.is_initialized());
}

TEST_F(IVFPQIndexTest, IndexTypeIsIVFPQ) {
    IVFPQIndex index(DistanceMetric::L2, NLIST, NPROBE, M, CODEBOOK_SIZE);
    EXPECT_EQ(index.type(), IndexType::IVF_PQ);
}
