//
// Created by viktor on 12/9/25.
//

#include <iostream>
#include <vector>

#include "../include/lynx/bruteforce_index.h"
#include "search.h"
#include "../include/lynx/index_loader.h"
#include "../include/lynx/index_registry.h"

int main() {
    IndexRegistry::register_index(
        IndexType::BRUTEFORCE,
        []() { return std::make_unique<BruteForceIndex>(); }
    );

    BruteForceIndex builder(3, DistanceMetric::L2);
    builder.add_vector(1, {1.0f, 2.0f, 3.0f});
    builder.add_vector(2, {0.0f, 1.0f, 1.0f});
    builder.add_vector(3, {5.0f, 5.0f, 5.0f});

    builder.save("test.lynx");

    auto index = IndexLoader::load("test.lynx");
    if (!index) {
        std::cerr << "Failed to load index\n";
        return 1;
    }

    auto results = index->search({0.0f, 0.0f, 0.0f}, 2);
    for (const auto& r : results) {
        std::cout << "ID: " << r.first << ", Distance: " << r.second << "\n";
    }

    return 0;
}
