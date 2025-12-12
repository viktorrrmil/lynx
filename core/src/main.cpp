//
// Created by viktor on 12/9/25.
//

#include <iostream>
#include <vector>

#include "../include/lynx/bruteforce_index.h"
#include "search.h"

int main() {
    BruteForceIndex index(3);

    index.add_vector(1, {1.0f, 2.0f, 3.0f});
    index.add_vector(2, {0.0f, 1.0f, 1.0f});
    index.add_vector(3, {5.0f, 5.0f, 5.0f});

    if (!index.save("test.lynx")) {
        std::cout << "Failed to save file!" << std::endl;
    }

    auto results = index.search({0.0f, 0.0f, 0.0f}, 2);

    for (const auto& result : results) {
        std::cout << "ID: " << result.first << ", Distance: " << result.second << std::endl;
    }

    BruteForceIndex loaded(3);
    loaded.load("test.lynx");

    auto results2 = loaded.search({0.0f, 0.0f, 0.0f}, 2);

    for (const auto& result : results2) {
        std::cout << "Loaded ID: " << result.first << ", Distance: " << result.second << std::endl;
    }

    return 0;
}
