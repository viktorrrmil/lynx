from sentence_transformers import SentenceTransformer
import numpy as np
import json

from tqdm import tqdm

model = SentenceTransformer("all-MiniLM-L6-v2")

class Embedder:
    def __init__(self, model_name="all-MiniLM-L6-v2", normalize=True):
        self.model = SentenceTransformer(model_name)
        self.normalize = normalize

    def embed_texts(self, texts: list[str]) -> np.ndarray:
        vectors = []
        for text in tqdm(texts, desc="Embedding texts"):
            vec = self.model.encode(
                text,
                convert_to_numpy=True,
                normalize_embeddings=self.normalize
            )
            vectors.append(vec)
        return np.vstack(vectors).astype(np.float32)