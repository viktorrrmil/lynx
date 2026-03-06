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
      uniform_dist_(0.0f, 1.0f),
      initialized_(true),
      is_built_(false) {
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

std::vector<size_t> HNSWIndex::select_neighbors(std::priority_queue<std::pair<float, size_t> > candidates,
                                                int max_neighbors) const {
    std::vector<std::pair<float, size_t> > sorted_candidates;
    while (!candidates.empty()) {
        sorted_candidates.push_back(candidates.top());
        candidates.pop();
    }
    std::sort(sorted_candidates.begin(), sorted_candidates.end(),
              [](const auto &a, const auto &b) { return a.first < b.first; });

    // Use heuristic neighbor selection (SELECT-NEIGHBORS-HEURISTIC from HNSW paper)
    // This improves recall by selecting diverse neighbors, not just the closest ones
    std::vector<size_t> result;
    for (const auto &[dist, id]: sorted_candidates) {
        if (result.size() >= static_cast<size_t>(max_neighbors)) {
            break;
        }

        bool is_good = true;
        const auto &candidate_vec = vector_store_->get_vector(id);

        for (size_t selected_id: result) {
            float dist_to_selected = compute_distance(distance_metric_, candidate_vec,
                                                      vector_store_->get_vector(selected_id));
            if (dist_to_selected < dist) {
                is_good = false;
                break;
            }
        }

        if (is_good) {
            result.push_back(id);
        }
    }

    // If we don't have enough neighbors from the heuristic, add the remaining closest ones
    if (result.size() < static_cast<size_t>(max_neighbors)) {
        std::unordered_set<size_t> selected_set(result.begin(), result.end());
        for (const auto &[dist, id]: sorted_candidates) {
            if (result.size() >= static_cast<size_t>(max_neighbors)) {
                break;
            }
            if (selected_set.find(id) == selected_set.end()) {
                result.push_back(id);
                selected_set.insert(id);
            }
        }
    }

    return result;
}

void HNSWIndex::prune_neighbors(size_t node_id, int layer, int max_connections) {
    auto &neighbors = nodes_[node_id].neighbors[layer];
    if (neighbors.size() <= static_cast<size_t>(max_connections)) {
        return;
    }

    const auto &node_vector = vector_store_->get_vector(node_id);

    std::vector<std::pair<float, size_t> > neighbor_dists;
    neighbor_dists.reserve(neighbors.size());

    for (size_t neighbor: neighbors) {
        float dist = compute_distance(distance_metric_, node_vector, vector_store_->get_vector(neighbor));
        neighbor_dists.emplace_back(dist, neighbor);
    }

    std::sort(neighbor_dists.begin(), neighbor_dists.end(),
              [](const auto &a, const auto &b) { return a.first < b.first; });

    neighbors.clear();
    for (size_t i = 0; i < static_cast<size_t>(max_connections) && i < neighbor_dists.size(); i++) {
        neighbors.push_back(neighbor_dists[i].second);
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

IndexType HNSWIndex::type() const {
    return IndexType::HNSW;
}

bool HNSWIndex::set_vector_store(std::shared_ptr<InMemoryVectorStore> store) {
    if (!store) {
        return false;
    }

    vector_store_ = store;

    // Clear any existing graph structure
    clear();

    // Build the graph if there are vectors
    if (vector_store_->size() > 0) {
        return build();
    }


    return true;
}

size_t HNSWIndex::size() const {
    if (!vector_store_) return 0;
    return vector_store_->size();
}

int HNSWIndex::dimension() const {
    if (!vector_store_) return 0;
    return vector_store_->dimension();
}

bool HNSWIndex::build() {
    if (!vector_store_ || vector_store_->size() == 0) {
        return false;
    }

    // Clear any existing graph
    clear();

    // Resize nodes to accommodate all vectors
    nodes_.resize(vector_store_->size());

    // Insert all vectors into the graph
    for (size_t i = 0; i < vector_store_->size(); i++) {
        insert(i, vector_store_->get_vector(i));
    }

    is_built_ = true;
    return true;
}

void HNSWIndex::clear() {
    nodes_.clear();
    entry_point_ = NO_ENTRY_POINT;
    max_layer_ = 0;
}
