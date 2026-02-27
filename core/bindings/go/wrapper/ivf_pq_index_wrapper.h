//
// Created by viktor on 2/27/26.
//

#ifndef LYNX_IVF_PQ_INDEX_WRAPPER_H
#define LYNX_IVF_PQ_INDEX_WRAPPER_H

#ifdef __cplusplus
extern "C" {
#endif
    typedef struct {
        long id;
        float distance;
    } IVFPQSearchResult;

    typedef struct {
        IVFPQSearchResult *results;
        long count;
    } IVFPQSearchResults;

    void *IVFPQIndex_new(int metric, long nlist, long nprobe, long m, long codebook_size);

    void IVFPQIndex_delete(void *index);

    IVFPQSearchResults *IVFPQIndex_search(void *index, const float *query, long query_size, long k);

    void IVFPQIndex_free_search_results(IVFPQSearchResults *results);

    long IVFPQIndex_size(void *index);

    long IVFPQIndex_dimension(void *index);

    int IVFPQIndex_distance_metric(void *index);

    long IVFPQIndex_nlist(void *index);

    long IVFPQIndex_nprobe(void *index);

    void IVFPQIndex_set_nprobe(void *index, long nprobe);

    int IVFPQIndex_is_initialized(void *index);

    long IVFPQIndex_m(void *index);

    void IVFPQIndex_set_m(void *index, long m);

    long IVFPQIndex_codebook_size(void *index);

    void IVFPQIndex_set_codebook_size(void *index, long codebook_size);

    long IVFPQIndex_compressed_dim(void *index);

    void IVFPQIndex_set_compressed_dim(void *index, long compressed_dim);

    int IVFPQIndex_train(void *index, const float *training_data, long num_vectors, long vector_size, long n_iterations,
                        float tolerance, int populate_inverted_lists);

    int IVFPQIndex_set_vector_store(void *index, void *store);

    int IVFPQIndex_update_vectors(void *index);

#ifdef __cplusplus
}
#endif

#endif //LYNX_IVF_PQ_INDEX_WRAPPER_H