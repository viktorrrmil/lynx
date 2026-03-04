//
// Created by viktor on 3/4/26.
//

#include "lynx/hnsw_index.h"

#include <queue>
#include <span>
#include <unordered_set>

#include "lynx/in_memory_vector_store.h"

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

    for (size_t entry_point : entry_points) {
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

        for (size_t neighbor : nodes_[current_node].neighbors[layer]) {
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


void HNSWIndex::insert(size_t id, const std::span<const float>& vector) {
    // TODO: Implement this method for inserting new vectors into the HNSW index
}
