//
// Created by viktor on 1/20/26.
//

#ifndef LYNX_KMEANS_H
#define LYNX_KMEANS_H
#include <vector>

struct KMeansResult {
    std::vector<std::vector<float>> centroids;
    std::vector<int> assignments;
    int iterations;
    bool converged;
};

KMeansResult kmeans(
    const std::vector<std::vector<float>>& data,
    int k,
    int max_iterations = 100,
    float tolerance = 1e-4
);

#endif //LYNX_KMEANS_H
