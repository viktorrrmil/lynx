import lynx
import numpy as np

# Create index
print("Creating index...")
index = lynx.BruteForceIndex(dimension=384, metric=lynx.DistanceMetric.COSINE)

# Add some random vectors for testing
print("Adding vectors...")
for i in range(10):
    vector = np.random.randn(384).astype(np.float32).tolist()
    success = index.add_vector(i, vector)
    print(f"Added vector {i}: {success}")

print(f"Index size: {index.size()}")

# Search
query = np.random.randn(384).astype(np.float32).tolist()
results = index.search(query, k=3)
print(f"Search results: {results}")

# Save
index.save("test_index.lynx")
print("Index saved!")

# Load
loaded_index = lynx.load_index("test_index.lynx")
print(f"Loaded index size: {loaded_index.size()}")