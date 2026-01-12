"""
Basic usage example of Lynx vector search engine.
Shows index creation, adding vectors, and searching.
"""
import lynx
import numpy as np

def main():
    # Create index
    print("Creating index...")
    index = lynx.BruteForceIndex(dimension=384, metric=lynx.DistanceMetric.COSINE)

    # Add vectors
    print("Adding vectors...")
    for i in range(10):
        vector = np.random.randn(384).astype(np.float32).tolist()
        index.add_vector(i, vector)

    print(f"Index size: {index.size()}")

    # Search
    query = np.random.randn(384).astype(np.float32).tolist()
    results = index.search(query, k=3)
    print(f"Top 3 results: {results}")

    # Save
    index.save("example_index.lynx")
    print("Saved to example_index.lynx")

if __name__ == "__main__":
    main()