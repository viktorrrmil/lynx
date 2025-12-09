//
// Created by viktor on 12/9/25.
//

#include "bruteforce_index.h"

BruteForceIndex::BruteForceIndex(long dimension)
    : dimension_(dimension)
{
    vectors_.reserve(1024);
    ids_.reserve(1024);
}

bool BruteForceIndex::add_vector(long id, const std::vector<float>& vector_data) {
    if (vector_data.size() != dimension_) {
        return false;
    }

    if (id < 0) {
        return false;
    }

    for (long i = 0; i < ids_.size(); i++) {
        if (ids_[i] == id) return false;
    }

    ids_.push_back(id);
    vectors_.push_back(vector_data);

    return true;
}

long BruteForceIndex::size() const {
    return vectors_.size();
}
