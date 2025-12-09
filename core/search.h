//
// Created by viktor on 12/9/25.
//

#ifndef LYNX_SEARCH_H
#define LYNX_SEARCH_H
#include <vector>

double cosine_similarity(const std::vector<double> &vector_a, const std::vector<double> &vector_b);

std::vector<std::pair<int, double> > brute_force_search(
    const std::vector<std::vector<double> > &vectors,
    const std::vector<double> &query,
    int k
);

#endif //LYNX_SEARCH_H
