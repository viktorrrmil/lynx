//
// Created by viktor on 12/10/25.
//

#include "gtest/gtest.h"
#include "lynx/utils/metric.h"

// L2 distance

// L2 distance symmetry
TEST(L2DistanceTest, Symmetry) {
    std::vector<float> a = {1.0f, 2.0f, 3.0f};
    std::vector<float> b = {4.0f, 5.0f, 6.0f};

    float dist_ab = l2_distance(a, b);
    float dist_ba = l2_distance(b, a);

    EXPECT_FLOAT_EQ(dist_ab, dist_ba);
}


// L2 distance zero distance
TEST(L2DistanceTest, ZeroDistance) {
    std::vector<float> a = {1.0f, 2.0f, 3.0f};
    std::vector<float> b = {1.0f, 2.0f, 3.0f};

    float dist = l2_distance(a, b);

    EXPECT_FLOAT_EQ(dist, 0.0f);
}


// Cosine distance

// Cosine distance identical vectors
TEST(L2DistanceTest, IdenticalVectors) {
    std::vector<float> a = {1.0f, 0.0f, 0.0f};
    std::vector<float> b = {1.0f, 0.0f, 0.0f};

    float dist = cosine_distance(a, b);

    EXPECT_FLOAT_EQ(dist, 0.0f);
}

// Cosine distance opposite vectors
TEST(L2DistanceTest, OppositeVectors) {
    std::vector<float> a = {1.0f, 0.0f, 0.0f};
    std::vector<float> b = {-1.0f, 0.0f, 0.0f};

    float dist = cosine_distance(a, b);

    EXPECT_FLOAT_EQ(dist, 2.0f);
}

// Cosine distance zero vector handling
TEST(L2DistanceTest, ZeroVectorHandling) {
    std::vector<float> a = {0.0f, 0.0f, 0.0f};
    std::vector<float> b = {1.0f, 2.0f, 3.0f};

    EXPECT_THROW(cosine_distance(a, b), std::invalid_argument);
}