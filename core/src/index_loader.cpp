//
// Created by viktor on 12/18/25.
//

#include "../include/lynx/index_loader.h"
#include "../include/lynx/index_registry.h"
#include "../include/lynx/serialization.h"
#include <fstream>
#include <iostream>

namespace IndexLoader {
    std::unique_ptr<VectorIndex> load(const std::string& path) {
        std::ifstream in(path, std::ios::binary);
        if (!in.is_open()) {
            return nullptr;
        }

        if (!read_magic(in)) {
            return nullptr;
        }
        int64_t version;
        if (!read_int64(in, version)) {
            return nullptr;
        }
        if (version != VERSION) {
            return nullptr;
        }
        IndexType type;
        if (!read_int64(in, reinterpret_cast<int64_t&>(type))) {
            return nullptr;
        }

        DistanceMetric metric;
        if (!read_int64(in, reinterpret_cast<int64_t&>(metric))) {
            return nullptr;
        }
        if (metric != DistanceMetric::L2 && metric != DistanceMetric::COSINE) {
            return nullptr;
        }

        int64_t dimension;
        if (!read_int64(in, dimension)) {
            return nullptr;
        }
        if (dimension <= 0) {
            return nullptr;
        }
        auto index = IndexRegistry::create_index(type);
        if (!index) {
            return nullptr;
        }

        index->set_metric(metric);

        return index;
    }
}
