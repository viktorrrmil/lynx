//
// Created by viktor on 1/30/26.
//

#ifndef LYNX_VECTORSTORE_H
#define LYNX_VECTORSTORE_H
#include <cstddef>
#include <span>
#include <vector>

class VectorStore {
public:
    virtual ~VectorStore() = default;
    virtual std::size_t size() const = 0;
    virtual int dimension() const = 0;
    virtual std::span<const float> get_vector(std::size_t id) const = 0;
};

#endif //LYNX_VECTORSTORE_H