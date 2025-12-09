from sentence_transformers import SentenceTransformer
import numpy as np
import json

model = SentenceTransformer("all-MiniLM-L6-v2")

def embed_texts(texts):
    vectors = model.encode(texts)
    return vectors

if __name__ == "__main__":
    sample_dataset = [
        "Harry Potter wizard boy",
        "A fast sports car",
        "Magic wand spells",
        "Cute cats playing"
    ]

    vectors = embed_texts(sample_dataset)

    with open("vectors.json", "w") as f:
        json.dump({
            "texts": sample_dataset,
            "vectors": vectors.tolist()
        }, f)
