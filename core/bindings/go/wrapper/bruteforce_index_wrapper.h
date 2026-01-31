//
// Created by viktor on 1/15/26.
//

#ifndef LYNX_BRUTEFORCE_INDEX_WRAPPER_H
#define LYNX_BRUTEFORCE_INDEX_WRAPPER_H

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

    void* BruteForceIndex_new(int metric);
    void BruteForceIndex_delete(void* index);

    SearchResults* BruteForceIndex_search(void* index, const float* query, long query_size, long k);
    void BruteForceIndex_free_search_results(SearchResults* results);
    long BruteForceIndex_size(void* index);
    long BruteForceIndex_dimension(void* index);
    int BruteForceIndex_metric(void* index);

    int BruteForceIndex_set_vector_store(void* index, void* store);

    // void free(void* index);

#ifdef __cplusplus
}
#endif

#endif //LYNX_BRUTEFORCE_INDEX_WRAPPER_H