//
// Created by viktor on 1/21/26.
//

#include "ivf_index_wrapper.h"

#include "../include/lynx/ivf_index.h"
#include <fstream>
#include <vector>

class IVFIndex;
enum class DistanceMetric : int64_t;

extern "C" {
    void* IVFIndex_new(long dimension, int metric, long nlist, long nprobe) {
        return new IVFIndex(dimension, static_cast<DistanceMetric>(metric), nlist, nprobe);
    }

    bool IVFIndex_add_vector(void* index, long id, const float* vector_data, long vector_size) {
        auto* ivf_index = static_cast<IVFIndex*>(index);
        std::vector<float> vec(vector_data, vector_data + vector_size);
        return ivf_index->add_vector(id, vec);
    }

    void IVFIndex_delete(void* index) {
        delete static_cast<IVFIndex*>(index);
    }

    IVFSearchResults* IVFIndex_search(void* index, const float* query, long query_size, long k) {
        auto* ivf_index = static_cast<IVFIndex*>(index);
        std::vector<float> query_vec(query, query + query_size);

        auto cpp_results = ivf_index->search(query_vec, k);

        auto* results = new IVFSearchResults();
        results->count = cpp_results.size();
        results->results = new IVFSearchResult[results->count];

        for (long i = 0; i < results->count; i++) {
            results->results[i].id = cpp_results[i].first;
            results->results[i].distance = cpp_results[i].second;
        }

        return results;
    }

    void IVFIndex_free_search_results(IVFSearchResults* results) {
        if (results) {
            delete[] results->results;
            delete results;
        }
    }

    long IVFIndex_size(void* index) {
        auto* ivf_index = static_cast<IVFIndex*>(index);
        return ivf_index->size();
    }

    long IVFIndex_dimension(void* index) {
        auto* ivf_index = static_cast<IVFIndex*>(index);
        return ivf_index->dimension();
    }

    int IVFIndex_metric(void* index) {
        auto* ivf_index = static_cast<IVFIndex*>(index);
        return static_cast<int>(ivf_index->metric());
    }

    bool IVFIndex_save(void* index, const char* path) {
        auto* ivf_index = static_cast<IVFIndex*>(index);
        return ivf_index->save(std::string(path));
    }

    bool IVFIndex_load(void* index, const char* path) {
        auto* ivf_index = static_cast<IVFIndex*>(index);
        std::ifstream in(path, std::ios::binary);
        if (!in.is_open()) {
            return false;
        }
        return ivf_index->load(in);
    }

    bool IVFIndex_train(void* index, const float* training_data, long num_vectors, long vector_size, long n_iterations, float tolerance) {
        auto* ivf_index = static_cast<IVFIndex*>(index);
        std::vector<std::vector<float>> data;
        data.reserve(num_vectors);

        for (long i = 0; i < num_vectors; i++) {
            std::vector<float> vec(training_data + i * vector_size, training_data + (i + 1) * vector_size);
            data.push_back(vec);
        }

        return ivf_index->train(data, n_iterations, tolerance);
    }
}
