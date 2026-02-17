//
// Created by viktor on 1/21/26.
//

#ifndef LYNX_IVF_INDEX_WRAPPER_H
#define LYNX_IVF_INDEX_WRAPPER_H

#include <stdbool.h>

#include "bruteforce_index_wrapper.h"

#ifdef __cplusplus
extern "C" {
#endif
typedef struct {
    long id;
    float distance;
} IVFSearchResult;

typedef struct {
    IVFSearchResult *results;
    long count;
} IVFSearchResults;

void *IVFIndex_new(int metric, long nlist, long nprobe);

void IVFIndex_delete(void *index);

IVFSearchResults *IVFIndex_search(void *index, const float *query, long query_size, long k);

void IVFIndex_free_search_results(IVFSearchResults *results);

long IVFIndex_size(void *index);

long IVFIndex_dimension(void *index);

int IVFIndex_distance_metric(void *index);

long IVFIndex_nlist(void *index);

long IVFIndex_nprobe(void *index);

void IVFIndex_set_nprobe(void *index, long nprobe);

int IVFIndex_is_initialized(void *index);

int IVFIndex_train(void *index, const float *training_data, long num_vectors, long vector_size, long n_iterations,
                    float tolerance);

int IVFIndex_set_vector_store(void *index, void *store);

int IVFIndex_update_vectors(void *index);

#ifdef __cplusplus
}
#endif

#endif //LYNX_IVF_INDEX_WRAPPER_H
