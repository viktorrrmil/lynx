//
// Created by viktor on 1/30/26.
//

#ifndef LYNX_INMEMORYVECTORSTORE_H
#define LYNX_INMEMORYVECTORSTORE_H
#include "vector_store.h"

class InMemoryVectorStore : public VectorStore {
public:
    InMemoryVectorStore() = default;
    ~InMemoryVectorStore() override = default;

    std::vector<std::vector<float>> data_;

    std::size_t size() const override;

    int dimension() const override;

    std::span<const float> get_vector(std::size_t id) const override;

    bool add_vector(const std::vector<float>& vector_data);
    bool add_batch(const std::vector<std::vector<float>>& vectors);
};

#endif //LYNX_INMEMORYVECTORSTORE_H