//
// Created by viktor on 3/5/26.
//

#ifndef LYNX_HNSW_INDEX_WRPPER_H
#define LYNX_HNSW_INDEX_WRPPER_H

#ifdef __cplusplus
extern "C" {
#endif
    typedef struct {
        long id;
        float distance;
    } HNSWSearchResult;

    typedef struct {
        HNSWSearchResult *results;
        long count;
    } HNSWSearchResults;

    void *HNSWIndex_new(int metric, long M, long ef_construction, long ef_search);

    void HNSWIndex_delete(void *index);

    HNSWSearchResults* HNSWIndex_search(void *index, const float *query, long query_size, long k);

    void HNSWIndex_free_search_results(HNSWSearchResults *results);

    long HNSWIndex_size(void *index);

    long HNSWIndex_dimension(void *index);

    int HNSWIndex_distance_metric(void *index);

    long HNSWIndex_M(void *index);

    void HNSWIndex_set_M(void *index, long M);

    long HNSWIndex_ef_construction(void *index);

    void HNSWIndex_set_ef_construction(void *index, long ef_construction);

    long HNSWIndex_ef_search(void *index);

    void HNSWIndex_set_ef_search(void *index, long ef_search);

    int HNSWIndex_is_initialized(void *index);

    int HNSWIndex_set_vector_store(void *index, void *store);

    int HNSWIndex_update_vectors(void *index);

#ifdef __cplusplus
}
#endif

#endif //LYNX_HNSW_INDEX_WRPPER_H