//
// Created by viktor on 2/22/26.
//

#ifndef LYNX_IVF_PQ_INDEX_H
#define LYNX_IVF_PQ_INDEX_H

#include "vector_index.h"


class IVFPQIndex : public VectorIndex {
private:
    DistanceMetric distance_metric_;
    std::shared_ptr<InMemoryVectorStore> vector_store_;

    // IVF specific members
    std::vector<std::vector<float> > centroids_;
    std::vector<std::vector<std::size_t> > inverted_lists_;
    bool is_trained_;
    std::int64_t nlist_;
    std::int64_t nprobe_;

    std::vector<std::uint8_t> encode_vector(const std::span<const float> &vector) const;
    std::vector<float> reconstruct_vector(const std::vector<std::uint8_t> &code) const;

    // PQ specific members
    std::int64_t m_; // number of sub-spaces
    std::int64_t codebook_size_; // number of centroids per sub-space
    std::int64_t compressed_dim_; // dimension of each sub-space

    std::vector<std::vector<std::vector<float>>> pq_codebooks_;
    std::vector<std::vector<std::uint8_t>> pq_codes_;

public:
    IVFPQIndex() : distance_metric_(DistanceMetric::L2), is_trained_(false), nlist_(0), nprobe_(0), m_(0), codebook_size_(0), compressed_dim_(0) {
    }

    explicit IVFPQIndex(DistanceMetric metric, std::int64_t nlist, std::int64_t nprobe, std::int64_t m, std::int64_t codebook_size);


    void set_distance_metric(DistanceMetric metric) override {
        distance_metric_ = metric;
    }

    DistanceMetric distance_metric() const override {
        return distance_metric_;
    }

    int64_t nlist() const {
        return nlist_;
    }

    int64_t nprobe() const {
        return nprobe_;
    }

    void set_nprobe(int64_t nprobe) {
        nprobe_ = nprobe;
    }

    int64_t m() const {
        return m_;
    }

    void set_m(int64_t m) {
        m_ = m;
    }

    int64_t codebook_size() const {
        return codebook_size_;
    }

    void set_codebook_size(int64_t codebook_size) {
        codebook_size_ = codebook_size;
    }

    int64_t compressed_dim() const {
        return compressed_dim_;
    }

    void set_compressed_dim(int64_t compressed_dim) {
        compressed_dim_ = compressed_dim;
    }

    std::vector<std::pair<long, float> >
    search(const std::span<const float> &query, long k) const override;

    IndexType type() const override;

    bool set_vector_store(std::shared_ptr<InMemoryVectorStore> store) override;

    size_t size() const;

    int dimension() const;

    // IVF-PQ specific methods
    bool train(const std::vector<std::vector<float> > &training_data, std::int64_t n_iterations = 100,
               float tolerance = 1e-4, bool populate_inverted_lists = false);

    bool update_vectors();

    bool is_initialized() const {
        return is_trained_ && !centroids_.empty() && !inverted_lists_.empty();
    }
};

#endif //LYNX_IVF_PQ_INDEX_H