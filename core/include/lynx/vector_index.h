//
// Created by viktor on 12/10/25.
//

#ifndef LYNX_VECTOR_INDEX_H
#define LYNX_VECTOR_INDEX_H
#include <vector>

class VectorIndex {
public:
    virtual bool add_vector(long id, const std::vector<float>& vector_data) = 0;
    virtual std::vector<std::pair<long, float>> search(const std::vector<float>& query, long k) const = 0;
    virtual std::size_t size() const = 0;
    virtual ~VectorIndex() = default;
};

#endif //LYNX_VECTOR_INDEX_H