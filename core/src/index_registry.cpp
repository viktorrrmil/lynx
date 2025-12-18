//
// Created by viktor on 12/10/25.
//

#include "../include/lynx/index_registry.h"

#include "../include/lynx/bruteforce_index.h"
#include <unordered_map>

std::unordered_map<IndexType, IndexCreator>& IndexRegistry::get_registry() {
    static std::unordered_map<IndexType, IndexCreator> registry;
    return registry;
}

void IndexRegistry::register_index(IndexType type, IndexCreator creator) {
    auto& registry = get_registry();
    registry[type] = creator;
}

std::unique_ptr<VectorIndex> IndexRegistry::create_index(IndexType type) {
    auto& registry = get_registry();
    auto it = registry.find(type);
    if (it != registry.end()) {
        return it->second();
    }
    return nullptr;
}