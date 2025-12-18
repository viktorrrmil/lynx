//
// Created by viktor on 12/18/25.
//

#ifndef LYNX_INDEX_REGISTRY_H
#define LYNX_INDEX_REGISTRY_H
#include <functional>
#include <memory>
#include <unordered_map>

#include "vector_index.h"

using IndexCreator = std::function<std::unique_ptr<VectorIndex>()>;

class IndexRegistry {
public:
    static void register_index(IndexType type, IndexCreator creator);
    static std::unique_ptr<VectorIndex> create_index(IndexType type);

private:
    static std::unordered_map<IndexType, IndexCreator>& get_registry();
};

#endif //LYNX_INDEX_REGISTRY_H
