//
// Created by viktor on 12/18/25.
//

#ifndef LYNX_INDEX_LOADER_H
#define LYNX_INDEX_LOADER_H
#include <memory>
#include <string>

#include "vector_index.h"

namespace IndexLoader {
    std::unique_ptr<VectorIndex> load(const std::string& path);
}

#endif //LYNX_INDEX_LOADER_H