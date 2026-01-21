//
// Created by viktor on 1/15/26.
//

#ifndef LYNX_BRUTEFORCE_INDEX_WRAPPER_H
#define LYNX_BRUTEFORCE_INDEX_WRAPPER_H

#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

    typedef struct {
        long id;
        float distance;
    } SearchResult;

    typedef struct {
        SearchResult* results;
        long count;
    } SearchResults;

    typedef struct {
        float* data;
        long length;
    } VectorData;


    void* BruteForceIndex_new(long dimension, int metric);
    void BruteForceIndex_delete(void* index);
    bool BruteForceIndex_add_vector(void* index, long id, const float* vector_data, long vector_size);
    VectorData* BruteForceIndex_get_vector(void* index, long id);
    SearchResults* BruteForceIndex_search(void* index, const float* query, long query_size, long k);
    void BruteForceIndex_free_search_results(SearchResults* results);
    long BruteForceIndex_size(void* index);
    bool BruteForceIndex_save(void* index, const char* path);
    bool BruteForceIndex_load(void* index, const char* path);
    long BruteForceIndex_dimension(void* index);
    int BruteForceIndex_metric(void* index);

    void BruteForceIndex_free_vector(VectorData* vector);

    // void free(void* index);

#ifdef __cplusplus
}
#endif

#endif //LYNX_BRUTEFORCE_INDEX_WRAPPER_H