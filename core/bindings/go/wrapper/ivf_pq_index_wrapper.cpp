//
// Created by viktor on 2/27/26.
//

#include "ivf_pq_index_wrapper.h"
#include "lynx/ivf_pq_index.h"

enum class DistanceMetric : signed long int;

extern "C" {
void *IVFPQIndex_new(int metric, long nlist, long nprobe, long m, long codebook_size) {
    return new IVFPQIndex(static_cast<DistanceMetric>(metric), nlist, nprobe, m, codebook_size);
}

void IVFPQIndex_delete(void *index) {
    delete static_cast<IVFPQIndex *>(index);
}

IVFPQSearchResults *IVFPQIndex_search(void *index, const float *query, long query_size, long k) {
    auto *ivf_index = static_cast<IVFPQIndex *>(index);
    std::vector<float> query_vec(query, query + query_size);

    auto cpp_results = ivf_index->search(query_vec, k);

    auto *results = new IVFPQSearchResults();
    results->count = cpp_results.size();
    results->results = new IVFPQSearchResult[results->count];

    for (long i = 0; i < results->count; i++) {
        results->results[i].id = cpp_results[i].first;
        results->results[i].distance = cpp_results[i].second;
    }

    return results;
}

void IVFPQIndex_free_search_results(IVFPQSearchResults *results) {
    if (results) {
        delete[] results->results;
        delete results;
    }
}

long IVFPQIndex_size(void *index) {
    auto *ivf_index = static_cast<IVFPQIndex *>(index);
    return ivf_index->size();
}

long IVFPQIndex_dimension(void *index) {
    auto *ivf_index = static_cast<IVFPQIndex *>(index);
    return ivf_index->dimension();
}

int IVFPQIndex_distance_metric(void *index) {
    auto *ivf_index = static_cast<IVFPQIndex *>(index);
    return static_cast<int>(ivf_index->distance_metric());
}

long IVFPQIndex_nlist(void *index) {
    auto *ivf_index = static_cast<IVFPQIndex *>(index);
    return ivf_index->nlist();
}

long IVFPQIndex_nprobe(void *index) {
    auto *ivf_index = static_cast<IVFPQIndex *>(index);
    return ivf_index->nprobe();
}

void IVFPQIndex_set_nprobe(void *index, long nprobe) {
    auto *ivf_index = static_cast<IVFPQIndex *>(index);
    ivf_index->set_nprobe(nprobe);
}

int IVFPQIndex_is_initialized(void *index) {
    auto *ivf_index = static_cast<IVFPQIndex *>(index);
    return ivf_index->is_initialized() ? 1 : 0;
}

long IVFPQIndex_m(void *index) {
    auto *ivf_index = static_cast<IVFPQIndex *>(index);
    return ivf_index->m();
}

void IVFPQIndex_set_m(void *index, long m) {
    auto *ivf_index = static_cast<IVFPQIndex *>(index);
    ivf_index->set_m(m);
}

long IVFPQIndex_codebook_size(void *index) {
    auto *ivf_index = static_cast<IVFPQIndex *>(index);
    return ivf_index->codebook_size();
}

void IVFPQIndex_set_codebook_size(void *index, long codebook_size) {
    auto *ivf_index = static_cast<IVFPQIndex *>(index);
    ivf_index->set_codebook_size(codebook_size);
}

long IVFPQIndex_compressed_dim(void *index) {
    auto *ivf_index = static_cast<IVFPQIndex *>(index);
    return ivf_index->compressed_dim();
}

void IVFPQIndex_set_compressed_dim(void *index, long compressed_dim) {
    auto *ivf_index = static_cast<IVFPQIndex *>(index);
    ivf_index->set_compressed_dim(compressed_dim);
}

int IVFPQIndex_train(void *index, const float *training_data, long num_vectors, long vector_size, long n_iterations,
                    float tolerance, int populate_inverted_lists) {
    auto *ivf_index = static_cast<IVFPQIndex *>(index);
    std::vector<std::vector<float> > data;
    data.reserve(num_vectors);

    for (long i = 0; i < num_vectors; i++) {
        std::vector<float> vec(training_data + i * vector_size, training_data + (i + 1) * vector_size);
        data.push_back(vec);
    }

    return ivf_index->train(data, n_iterations, tolerance, populate_inverted_lists != 0) ? 1 : 0;
}

int IVFPQIndex_set_vector_store(void *index, void *store) {
    auto *ivf_index = static_cast<IVFPQIndex *>(index);
    auto *vec_store = static_cast<InMemoryVectorStore *>(store);

    auto shared_store = std::shared_ptr<InMemoryVectorStore>(vec_store, [](InMemoryVectorStore *) {
    });

    return ivf_index->set_vector_store(shared_store) ? 1 : 0;
}

int IVFPQIndex_update_vectors(void *index) {
    auto *ivf_index = static_cast<IVFPQIndex *>(index);
    return ivf_index->update_vectors() ? 1 : 0;
}
}
