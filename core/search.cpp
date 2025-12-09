//
// Created by viktor on 12/9/25.
//

#include <algorithm>
#include <vector>
#include <cmath>

double cosine_similarity(const std::vector<double> &vector_a, const std::vector<double> &vector_b) {
    double dot = 0.0, normA = 0.0, normB = 0.0;

    for (size_t i = 0; i < vector_a.size(); i++) {
        dot += vector_a[i] * vector_b[i];
        normA += vector_a[i] * vector_a[i];
        normB += vector_b[i] * vector_b[i];
    }

    return dot / (std::sqrt(normA) * std::sqrt(normB));
}

std::vector<std::pair<int, double> > brute_force_search(
    const std::vector<std::vector<double> > &vectors,
    const std::vector<double> &query,
    int k
) {
    std::vector<std::pair<int, double> > scores;

    for (int i = 0; i < vectors.size(); i++) {
        double sim = cosine_similarity(query, vectors[i]);
        scores.push_back({i, sim});
    }

    std::sort(scores.begin(), scores.end(),
              [](auto &a, auto &b) {
                  return a.second > b.second;
              });

    if (scores.size() > k) {
        scores.resize(k);
    }

    return scores;
}
