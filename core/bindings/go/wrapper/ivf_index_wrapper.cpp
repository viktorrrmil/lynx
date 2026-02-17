//
// Created by viktor on 1/21/26.
//

#include "ivf_index_wrapper.h"

#include "../include/lynx/ivf_index.h"

class IVFIndex;
enum class DistanceMetric : int64_t;

extern "C" {
void *IVFIndex_new(int metric, long nlist, long nprobe) {
    return new IVFIndex(static_cast<DistanceMetric>(metric), nlist, nprobe);
}

void IVFIndex_delete(void *index) {
    delete static_cast<IVFIndex *>(index);
}

IVFSearchResults *IVFIndex_search(void *index, const float *query, long query_size, long k) {
    auto *ivf_index = static_cast<IVFIndex *>(index);
    std::vector<float> query_vec(query, query + query_size);

    auto cpp_results = ivf_index->search(query_vec, k);

    auto *results = new IVFSearchResults();
    results->count = cpp_results.size();
    results->results = new IVFSearchResult[results->count];

    for (long i = 0; i < results->count; i++) {
        results->results[i].id = cpp_results[i].first;
        results->results[i].distance = cpp_results[i].second;
    }

    return results;
}

void IVFIndex_free_search_results(IVFSearchResults *results) {
    if (results) {
        delete[] results->results;
        delete results;
    }
}

long IVFIndex_size(void *index) {
    auto *ivf_index = static_cast<IVFIndex *>(index);
    return ivf_index->size();
}

long IVFIndex_dimension(void *index) {
    auto *ivf_index = static_cast<IVFIndex *>(index);
    return ivf_index->dimension();
}

int IVFIndex_distance_metric(void *index) {
    auto *ivf_index = static_cast<IVFIndex *>(index);
    return static_cast<int>(ivf_index->distance_metric());
}

long IVFIndex_nlist(void *index) {
    auto *ivf_index = static_cast<IVFIndex *>(index);
    return ivf_index->nlist();
}

long IVFIndex_nprobe(void *index) {
    auto *ivf_index = static_cast<IVFIndex *>(index);
    return ivf_index->nprobe();
}

void IVFIndex_set_nprobe(void *index, long nprobe) {
    auto *ivf_index = static_cast<IVFIndex *>(index);
    ivf_index->set_nprobe(nprobe);
}

int IVFIndex_is_initialized(void *index) {
    auto *ivf_index = static_cast<IVFIndex *>(index);
    return ivf_index->is_initialized() ? 1 : 0;
}

int IVFIndex_train(void *index, const float *training_data, long num_vectors, long vector_size, long n_iterations,
                    float tolerance) {
    auto *ivf_index = static_cast<IVFIndex *>(index);
    std::vector<std::vector<float> > data;
    data.reserve(num_vectors);

    for (long i = 0; i < num_vectors; i++) {
        std::vector<float> vec(training_data + i * vector_size, training_data + (i + 1) * vector_size);
        data.push_back(vec);
    }

    return ivf_index->train(data, n_iterations, tolerance) ? 1 : 0;
}

int IVFIndex_set_vector_store(void *index, void *store) {
    auto *ivf_index = static_cast<IVFIndex *>(index);
    auto *vec_store = static_cast<InMemoryVectorStore *>(store);

    auto shared_store = std::shared_ptr<InMemoryVectorStore>(vec_store, [](InMemoryVectorStore *) {
    });

    return ivf_index->set_vector_store(shared_store) ? 1 : 0;
}

int IVFIndex_update_vectors(void *index) {
    auto *ivf_index = static_cast<IVFIndex *>(index);
    return ivf_index->update_vectors() ? 1 : 0;
}
}
