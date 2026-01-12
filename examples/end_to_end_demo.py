"""
Complete end-to-end example: text → embeddings → index → search
"""
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from embeddings.embed import Embedder
import lynx

def main():
    texts = [
        "vector search engines are alright",
        "i have many unfulfilled dreams",
        "i'm not happy with my life",
        "systems engineering is interesting",
        "when will my life become better"
    ]

    # Generate embeddings
    print("Generating embeddings...")
    embedder = Embedder()
    vectors = embedder.embed_texts(texts)

    # Create and populate index
    dimension = vectors.shape[1]
    index = lynx.BruteForceIndex(dimension=dimension, metric=lynx.DistanceMetric.COSINE)

    for i, vec in enumerate(vectors):
        index.add_vector(i, vec.tolist())

    # Search
    query_text = "life fulfillment and happiness"
    print(f"\nSearching for: '{query_text}'")
    query_vec = embedder.embed_texts([query_text])[0]
    results = index.search(query_vec.tolist(), k=3)

    print("\nTop 3 results:")
    for idx, distance in results:
        print(f"  {texts[idx]} (distance: {distance:.4f})")

if __name__ == "__main__":
    main()