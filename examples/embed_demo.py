from embeddings.embed import Embedder

texts = [
    "vector search engines are alright",
    "i have many unfulfilled dreams",
    "i'm not happy with my life",
    "systems engineering is interesting",
    "when will my life become better"
]

embedder = Embedder()
vectors = embedder.embed_texts(texts)

print(vectors.shape)
print(vectors.dtype)