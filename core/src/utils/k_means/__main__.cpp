//
// Created by viktor on 1/20/26.
//

#include <fstream>
#include <iostream>
#include <random>
#include <sstream>

#include "../../../include/lynx/utils/kmeans.h"

std::vector<std::vector<float>> read_csv(const std::string& filename) {
    std::vector<std::vector<float>> points;

    std::ifstream file(filename);
    std::string line;

    while (std::getline(file, line)) {
        std::vector<float> point;
        std::stringstream ss(line);
        std::string value;

        while (std::getline(ss, value, ',')) {
            point.push_back(std::stof(value));
        }

        points.push_back(point);
    }

    return points;
}

int main(int argc, char *argv[]) {
    std::ofstream file("points.csv");

    std::mt19937 rng(42);
    std::normal_distribution<float> noise(0.0f, 0.3f);

    std::vector<std::pair<float, float>> centers = {
        {1.0f, 1.0f},
        {5.0f, 5.0f},
        {9.0f, 1.0f},
        {5.0f, 9.0f}
    };

    for (auto [cx, cy] : centers) {
        for (int i = 0; i < 250; i++) {
            file << cx + noise(rng) << "," << cy + noise(rng) << "\n";
        }
    }

    std::vector<std::vector<float>> test_data = read_csv("points.csv");

    auto result = kmeans(test_data, 31, 100, 1e-4);

    std::cout << "Converged: " << result.converged << "\n";
    std::cout << "Iterations: " << result.iterations << "\n";

    std::cout << "Centroids:\n";
    for (const auto& centroid : result.centroids) {
        for (float value : centroid) {
            std::cout << value << " ";

        }
        std::cout << std::endl;
    }

    std::cout << "Cluster sizes:\n";
    std::vector<int> cluster_sizes(result.centroids.size(), 0);
    for (int assignment : result.assignments) {
        cluster_sizes[assignment]++;
    }
    for (size_t i = 0; i < cluster_sizes.size(); i++) {
        std::cout << "Cluster " << i << ": " << cluster_sizes[i] << " points\n";
    }
    // std::cout << "Assignments: ";
    // for (int a : result.assignments) {
    //     std::cout << a << " ";
    // }
}
