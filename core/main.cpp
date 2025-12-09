//
// Created by viktor on 12/9/25.
//

#include <iostream>
#include <vector>

#include "search.h"

int main() {
    std::vector<std::vector<double>> vectors = {
        {0.1, 0.2, 0.3},
        {0.9, 0.8, 0.7},
        {0.4, 0.4, 0.5}
    };

    std::vector<double> query = {0.1, 0.2, 0.3};

    int k = 2;

    auto results = brute_force_search(vectors, query, k);

    for (auto& result : results) {
        std::cout << "Index: " << result.first << ", Similarity: " << result.second << std::endl;
    }

    return 0;
}
