//
// Created by viktor on 3/4/26.
//

#include "lynx/hnsw_index.h"

#include <algorithm>
#include <cmath>
#include <queue>
#include <random>
#include <span>
#include <unordered_set>

#include "lynx/in_memory_vector_store.h"

HNSWIndex::HNSWIndex(DistanceMetric metric, int M, int ef_construction, int ef_search)
    : distance_metric_(metric), M_(M), m_max0_(2 * M),
      ef_construction_(ef_construction), ef_search_(ef_search),
      ml_(1.0f / std::log(static_cast<float>(M))),
      entry_point_(NO_ENTRY_POINT), max_layer_(0),
      rng_(std::random_device{}()),
      uniform_dist_(0.0f, 1.0f) {
}

std::priority_queue<std::pair<float, size_t> > HNSWIndex::search_layer(
    const std::span<const float> &query,
    std::vector<size_t> entry_points,
    int ef,
    int layer
) const {
    std::priority_queue<std::pair<float, size_t> > result;

    std::priority_queue<
        std::pair<float, size_t>,
        std::vector<std::pair<float, size_t> >,
        std::greater<>
    > candidates;

    std::unordered_set<size_t> visited;

    for (size_t entry_point: entry_points) {
        float dist = compute_distance(distance_metric_, query, vector_store_->get_vector(entry_point));
        result.emplace(dist, entry_point);
        candidates.emplace(dist, entry_point);
        visited.insert(entry_point);
    }

    while (!candidates.empty()) {
        auto [dist, current_node] = candidates.top();
        candidates.pop();

        if (dist > result.top().first && result.size() >= static_cast<size_t>(ef)) {
            break;
        }

        for (size_t neighbor: nodes_[current_node].neighbors[layer]) {
            if (visited.count(neighbor)) {
                continue;
            }
            visited.insert(neighbor);

            float neighbor_dist = compute_distance(distance_metric_, query, vector_store_->get_vector(neighbor));

            if (result.size() < static_cast<size_t>(ef) || neighbor_dist < result.top().first) {
                result.emplace(neighbor_dist, neighbor);
                candidates.emplace(neighbor_dist, neighbor);

                if (result.size() > static_cast<size_t>(ef)) {
                    result.pop();
                }
            }
        }
    }

    return result;
}

std::vector<size_t> HNSWIndex::select_neighbors(std::priority_queue<std::pair<float, size_t> > &candidates,
                                                int max_neighbors) const {
    std::vector<size_t> result;
    while (!candidates.empty()) {
        result.push_back(candidates.top().second);
        candidates.pop();
    }

    std::reverse(result.begin(), result.end());
    if (result.size() > max_neighbors) {
        result.resize(max_neighbors);
    }

    return result;
}

void HNSWIndex::prune_neighbors(size_t node_id, int layer, int max_connections) {
    auto &neighbors = nodes_[node_id].neighbors[layer];
    const auto &node_vector = vector_store_->get_vector(node_id);

    std::priority_queue<std::pair<float, size_t> > heap;
    for (size_t neighbor: neighbors) {
        float dist = compute_distance(distance_metric_, node_vector, vector_store_->get_vector(neighbor));
        heap.emplace(dist, neighbor);
        if (heap.size() > max_connections) {
            heap.pop();
        }
    }

    neighbors.clear();
    while (!heap.empty()) {
        neighbors.push_back(heap.top().second);
        heap.pop();
    }
}

void HNSWIndex::insert(size_t id, const std::span<const float> &vector) {
    int layer = static_cast<int>(-std::log(uniform_dist_(rng_)) * ml_);

    nodes_[id].top_layer = layer;
    nodes_[id].neighbors.resize(layer + 1);

    if (entry_point_ == NO_ENTRY_POINT) {
        entry_point_ = id;
        max_layer_ = layer;
        return;
    }

    std::vector<size_t> entry_points = {entry_point_};

    for (int current_layer = max_layer_; current_layer > layer; current_layer--) {
        auto found = search_layer(vector, entry_points, 1, current_layer);
        entry_points = {found.top().second};
    }

    for (int current_layer = std::min(layer, max_layer_); current_layer >= 0; current_layer--) {
        auto found = search_layer(vector, entry_points, ef_construction_, current_layer);

        int max_connections = (current_layer == 0) ? m_max0_ : M_;
        auto neighbors = select_neighbors(found, max_connections);

        nodes_[id].neighbors[current_layer] = neighbors;

        for (size_t neighbor_id: neighbors) {
            nodes_[neighbor_id].neighbors[current_layer].push_back(id);

            if (nodes_[neighbor_id].neighbors[current_layer].size() > max_connections) {
                prune_neighbors(neighbor_id, current_layer, max_connections);
            }
        }

        entry_points.clear();
        while (!found.empty()) {
            entry_points.push_back(found.top().second);
            found.pop();
        }
    }

    if (layer > max_layer_) {
        entry_point_ = id;
        max_layer_ = layer;
    }
}

std::vector<std::pair<long, float> > HNSWIndex::search(const std::span<const float> &query, long k) const {
    if (entry_point_ == NO_ENTRY_POINT) {
        return {};
    }

    std::vector<size_t> entry_points = {entry_point_};

    for (int current_layer = max_layer_; current_layer > 0; current_layer--) {
        auto found = search_layer(query, entry_points, 1, current_layer);
        entry_points = {found.top().second};
    }

    auto found = search_layer(query, entry_points, ef_search_, 0);

    std::vector<std::pair<long, float> > result;
    while (!found.empty()) {
        auto [dist, id] = found.top();
        found.pop();
        result.emplace_back(id, dist);
    }

    std::reverse(result.begin(), result.end());
    if (result.size() > k) {
        result.resize(k);
    }

    return result;
}
