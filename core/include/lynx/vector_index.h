//
// Created by viktor on 12/10/25.
//

#ifndef LYNX_VECTOR_INDEX_H
#define LYNX_VECTOR_INDEX_H
#include <vector>
#include <cstddef>

#include "utils/metric.h"

enum class IndexType : int64_t {
    BRUTEFORCE = 1,
    IVF = 2,
    HNSW = 3
};


namespace std {
    template <>
    struct hash<IndexType> {
        std::size_t operator()(IndexType t) const noexcept {
            return static_cast<std::size_t>(t);
        }
    };
}

class VectorIndex {
public:
    virtual ~VectorIndex() = default;

    virtual DistanceMetric metric() const = 0;
    virtual void set_metric(DistanceMetric metric) = 0;

    virtual void set_dimension(int64_t dimension) = 0;

    virtual bool add_vector(long id, const std::vector<float>& vector_data) = 0;

    virtual std::vector<std::pair<long, float>>
    search(const std::vector<float>& query, long k) const = 0;

    virtual std::size_t size() const = 0;

    virtual bool save(const std::string& path) const = 0;
    virtual bool load(std::ifstream &in) = 0;

    virtual IndexType type() const = 0;
};

#endif //LYNX_VECTOR_INDEX_H