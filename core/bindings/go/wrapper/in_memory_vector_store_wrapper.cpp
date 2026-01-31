//
// Created by viktor on 1/30/26.
//


#include <stdexcept>

#include "../include/lynx/in_memory_vector_store.h"

#include <stdbool.h>

extern "C" {
    void* InMemoryVectorStore_new() {
        return new InMemoryVectorStore();
    }

    void InMemoryVectorStore_delete(void* store) {
        delete static_cast<InMemoryVectorStore*>(store);
    }

    int InMemoryVectorStore_size(void* store) {
        auto* vec_store = static_cast<InMemoryVectorStore*>(store);
        return static_cast<int>(vec_store->size());
    }

    int InMemoryVectorStore_dimension(void* store) {
        auto* vec_store = static_cast<InMemoryVectorStore*>(store);
        return vec_store->dimension();
    }

    float* InMemoryVectorStore_get_vector(void* store, long id, long* out_size) {
        auto* vec_store = static_cast<InMemoryVectorStore*>(store);
        try {
            std::span<const float> vec_span = vec_store->get_vector(id);
            *out_size = static_cast<long>(vec_span.size());
            auto* result = new float[*out_size];
            for (long i = 0; i < *out_size; i++) {
                result[i] = vec_span[i];
            }
            return result;
        } catch (const std::out_of_range&) {
            *out_size = 0;
            return nullptr;
        }
    }

    void InMemoryVectorStore_free_vector(float* vector) {
        delete[] vector;
    }

    bool InMemoryVectorStore_add_vector(void* store, const float* vector_data, long vector_size) {
        auto* vec_store = static_cast<InMemoryVectorStore*>(store);
        std::vector<float> vec(vector_data, vector_data + vector_size);
        return vec_store->add_vector(vec);
    }

    bool InMemoryVectorStore_add_batch(void* store, const float* vectors_data, long num_vectors, long vector_size) {
        auto* vec_store = static_cast<InMemoryVectorStore*>(store);
        std::vector<std::vector<float>> vectors;
        vectors.reserve(num_vectors);
        for (long i = 0; i < num_vectors; i++) {
            std::vector<float> vec(vectors_data + i * vector_size, vectors_data + (i + 1) * vector_size);
            vectors.push_back(std::move(vec));
        }
        return vec_store->add_batch(vectors);
    }
}
