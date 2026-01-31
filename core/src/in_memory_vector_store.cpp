//
// Created by viktor on 1/30/26.
//

#include "../include/lynx/in_memory_vector_store.h"

#include <stdexcept>

std::size_t InMemoryVectorStore::size() const {
    return data_.size();
}

int InMemoryVectorStore::dimension() const {
    if (data_.empty()) {
        return 0;
    }
    return static_cast<int>(data_[0].size());
}

std::span<const float> InMemoryVectorStore::get_vector(std::size_t id) const {
    if (id >= size()) {
        throw std::out_of_range("Vector ID out of range");
    }

   return data_[id];
}

bool InMemoryVectorStore::add_vector(const std::vector<float> &vector_data) {
    if (!data_.empty() && dimension() != vector_data.size()) {
        return false;
    }

    data_.push_back(vector_data);
    return true;
}

bool InMemoryVectorStore::add_batch(const std::vector<std::vector<float>> &vectors) {
    for (const auto& vec : vectors) {
        if (!add_vector(vec)) {
            return false;
        }
    }
    return true;
}
