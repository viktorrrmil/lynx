
#include "../include/lynx/bruteforce_index.h"
#include <vector>

enum class DistanceMetric : int64_t;
class BruteForceIndex;

extern "C" {
    typedef struct {
        long id;
        float distance;
    } SearchResult;

    typedef struct {
        SearchResult* results;
        long count;
    } SearchResults;

    void* BruteForceIndex_new(int metric) {
        return new BruteForceIndex(static_cast<DistanceMetric>(metric));
    }

    void BruteForceIndex_delete(void* index) {
        delete static_cast<BruteForceIndex*>(index);
    }

    SearchResults* BruteForceIndex_search(void* index, const float* query, long query_size, long k) {
        auto* bf_index = static_cast<BruteForceIndex*>(index);

        std::span<const float> query_span(query, query_size);
        auto cpp_results = bf_index->search(query_span, k);

        auto* results = new SearchResults();
        results->count = cpp_results.size();
        results->results = new SearchResult[results->count];

        for (long i = 0; i < results->count; i++) {
            results->results[i].id = cpp_results[i].first;
            results->results[i].distance = cpp_results[i].second;
        }

        return results;
    }

    void BruteForceIndex_free_search_results(SearchResults* results) {
        if (results) {
            delete[] results->results;
            delete results;
        }
    }

    long BruteForceIndex_size(void* index) {
        auto* bf_index = static_cast<BruteForceIndex*>(index);
        return bf_index->size();
    }

    long BruteForceIndex_dimension(void* index) {
        auto* bf_index = static_cast<BruteForceIndex*>(index);
        return bf_index->dimension();
    }

    int BruteForceIndex_distance_metric(void* index) {
        auto* bf_index = static_cast<BruteForceIndex*>(index);
        return static_cast<int>(bf_index->distance_metric());
    }

    int BruteForceIndex_set_vector_store(void* index, void* store) {
        auto* bf_index = static_cast<BruteForceIndex*>(index);
        auto* vec_store = static_cast<InMemoryVectorStore*>(store);

        auto shared_store = std::shared_ptr<InMemoryVectorStore>(vec_store, [](InMemoryVectorStore*){});

        return bf_index->set_vector_store(shared_store) ? 1 : 0;
    }
}
