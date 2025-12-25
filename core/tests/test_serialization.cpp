//
// Created by viktor on 12/10/25.
//

#include "gtest/gtest.h"
#include "lynx/bruteforce_index.h"
#include "lynx/index_loader.h"
#include "lynx/index_registry.h"
#include "lynx/utils/metric.h"

// Save -> Load preserves results
TEST(SerializationTest, SaveLoadPreservesResults) {
    IndexRegistry::register_index(
        IndexType::BRUTEFORCE,
        []() { return std::make_unique<BruteForceIndex>(); }
    );

    BruteForceIndex index(2, DistanceMetric::L2);
    index.add_vector(1, {1.0f, 2.0f});
    index.add_vector(2, {2.0f, 3.0f});
    index.add_vector(3, {3.0f, 4.0f});

    auto original_results = index.search({1.0f, 2.0f}, 2);

    std::string filename = "temp_index.lynx";
    EXPECT_TRUE(index.save(filename));

    auto loaded_index = IndexLoader::load("temp_index.lynx");
    ASSERT_NE(loaded_index, nullptr);

    auto loaded_results = loaded_index->search({1.0f, 2.0f}, 2);

    ASSERT_EQ(original_results.size(), loaded_results.size());
    for (size_t i = 0; i < original_results.size(); i++) {
        EXPECT_EQ(original_results[i].first, loaded_results[i].first);
        EXPECT_FLOAT_EQ(original_results[i].second, loaded_results[i].second);
    }
}

// Handling invalid file during load
TEST(SerializationTest, LoadInvalidFile) {
    IndexRegistry::register_index(
        IndexType::BRUTEFORCE,
        []() { return std::make_unique<BruteForceIndex>(); }
    );

    auto loaded_index = IndexLoader::load("non_existent_file.lynx");
    EXPECT_EQ(loaded_index, nullptr);
}

// Serialization preserves metadata
TEST(SerializationTest, PreserveMetadata) {
    IndexRegistry::register_index(
        IndexType::BRUTEFORCE,
        []() { return std::make_unique<BruteForceIndex>(); }
    );

    BruteForceIndex index(3, DistanceMetric::COSINE);
    index.add_vector(1, {1.0f, 2.0f, 3.0f});
    index.add_vector(2, {4.0f, 5.0f, 6.0f});

    std::string filename = "temp_metadata_index.lynx";
    EXPECT_TRUE(index.save(filename));

    auto loaded_index = IndexLoader::load("temp_metadata_index.lynx");
    ASSERT_NE(loaded_index, nullptr);

    EXPECT_EQ(loaded_index->dimension(), 3);
    EXPECT_EQ(loaded_index->metric(), DistanceMetric::COSINE);
}