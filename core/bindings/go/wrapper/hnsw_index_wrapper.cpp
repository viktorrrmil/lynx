//
// Created by viktor on 3/5/26.
//

#include "hnsw_index_wrapper.h"

#include "lynx/hnsw_index.h"
#include "lynx/in_memory_vector_store.h"
#include "lynx/utils/metric.h"

extern "C" {
    void *HNSWIndex_new(int metric, long M, long ef_construction, long ef_search) {
        return new HNSWIndex(static_cast<DistanceMetric>(metric), M, ef_construction, ef_search);
    }

    void HNSWIndex_delete(void *index) {
        delete static_cast<HNSWIndex *>(index);
    }

    HNSWSearchResults* HNSWIndex_search(void *index, const float *query, long query_size, long k) {
        auto *hnsw_index = static_cast<HNSWIndex *>(index);
        std::vector<float> query_vec(query, query + query_size);

        auto cpp_results = hnsw_index->search(query_vec, k);

        auto *results = new HNSWSearchResults();
        results->count = cpp_results.size();
        results->results = new HNSWSearchResult[results->count];

        for (long i = 0; i < results->count; i++) {
            results->results[i].id = cpp_results[i].first;
            results->results[i].distance = cpp_results[i].second;
        }

        return results;
    }

    void HNSWIndex_free_search_results(HNSWSearchResults *results) {
        if (results) {
            delete[] results->results;
            delete results;
        }
    }

    long HNSWIndex_size(void *index) {
        auto *hnsw_index = static_cast<HNSWIndex *>(index);
        return hnsw_index->size();
    }

    long HNSWIndex_dimension(void *index) {
        auto *hnsw_index = static_cast<HNSWIndex *>(index);
        return hnsw_index->dimension();
    }

    int HNSWIndex_distance_metric(void *index) {
        auto *hnsw_index = static_cast<HNSWIndex *>(index);
        return static_cast<int>(hnsw_index->distance_metric());
    }

    long HNSWIndex_M(void *index) {
        auto *hnsw_index = static_cast<HNSWIndex *>(index);
        return hnsw_index->M();
    }

    void HNSWIndex_set_M(void *index, long M) {
        // TODO: Add setters in HNSWIndex
    }

    long HNSWIndex_ef_construction(void *index) {
        auto *hnsw_index = static_cast<HNSWIndex *>(index);
        return hnsw_index->ef_construction();
    }

    void HNSWIndex_set_ef_construction(void *index, long ef_construction) {
        // TODO: Add setters in HNSWIndex
    }

    long HNSWIndex_ef_search(void *index) {
        auto *hnsw_index = static_cast<HNSWIndex *>(index);
        return hnsw_index->ef_search();
    }

    void HNSWIndex_set_ef_search(void *index, long ef_search) {
        // TODO: Add setters in HNSWIndex
    }

    int HNSWIndex_is_initialized(void *index) {
        auto *hnsw_index = static_cast<HNSWIndex *>(index);
        return hnsw_index->size() > 0 ? 1 : 0;
    }

    int HNSWIndex_set_vector_store(void *index, void *store) {
        auto *hnsw_index = static_cast<HNSWIndex *>(index);
        auto *vector_store = static_cast<InMemoryVectorStore *>(store);

        // Create a non-owning shared_ptr
        auto shared_store = std::shared_ptr<InMemoryVectorStore>(vector_store, [](InMemoryVectorStore *) {
        });

        return hnsw_index->set_vector_store(shared_store) ? 1 : 0;
    }

    int HNSWIndex_update_vectors(void *index) {
        auto *hnsw_index = static_cast<HNSWIndex *>(index);
        // Rebuild the HNSW graph with the updated vectors
        return hnsw_index->build() ? 1 : 0;
    }
}
