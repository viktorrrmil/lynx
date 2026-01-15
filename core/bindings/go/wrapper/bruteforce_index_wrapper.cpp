
#include "../include/lynx/bruteforce_index.h"
#include <fstream>

extern "C" {
    void* BruteForceIndex_new(long dimension, int metric) {
        return new BruteForceIndex(dimension, static_cast<DistanceMetric>(metric));
    }

    bool BruteForceIndex_add_vector(void* index, long id, const float* vector_data, long vector_size) {
        auto* bf_index = static_cast<BruteForceIndex*>(index);
        std::vector<float> vec(vector_data, vector_data + vector_size);
        return bf_index->add_vector(id, vec);
    }

    void BruteForceIndex_delete(void* index) {
        delete static_cast<BruteForceIndex*>(index);
    }

    typedef struct {
        long id;
        float distance;
    } SearchResult;

    typedef struct {
        SearchResult* results;
        long count;
    } SearchResults;

    SearchResults* BruteForceIndex_search(void* index, const float* query, long query_size, long k) {
        auto* bf_index = static_cast<BruteForceIndex*>(index);
        std::vector<float> query_vec(query, query + query_size);

        auto cpp_results = bf_index->search(query_vec, k);

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

    int BruteForceIndex_metric(void* index) {
        auto* bf_index = static_cast<BruteForceIndex*>(index);
        return static_cast<int>(bf_index->metric());
    }

    bool BruteForceIndex_save(void* index, const char* path) {
        auto* bf_index = static_cast<BruteForceIndex*>(index);
        return bf_index->save(std::string(path));
    }

    bool BruteForceIndex_load(void* index, const char* path) {
        auto* bf_index = static_cast<BruteForceIndex*>(index);
        std::ifstream ifs(path, std::ios::binary);
        if (!ifs.is_open()) {
            return false;
        }
        return bf_index->load(ifs);
    }
}
