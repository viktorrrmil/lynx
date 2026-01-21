from flask import Flask, request, jsonify
from sentence_transformers import SentenceTransformer
import torch
device = 'cuda' if torch.cuda.is_available() else 'cpu'

app = Flask(__name__)
model = SentenceTransformer("all-MiniLM-L6-v2", device=device)

@app.route("/embed_text", methods=["POST"])
def embed_text():
    data = request.json
    text = data["text"]

    if not text:
        return jsonify({"error": "No texts provided"}), 400

    vec = model.encode(text)

    return jsonify({
        "embedding": vec.tolist(),
        "dimension": len(vec)
    })

@app.route("/embed_text_batch", methods=["POST"])
def embed_text_batch():
    data = request.json
    texts = data["batch"]

    if not texts:
        return jsonify({"error": "No texts provided"}), 400

    vectors = model.encode(texts, convert_to_numpy=True, normalize_embeddings=True, show_progress_bar=True)

    return jsonify({
        "batch_embedding": vectors.tolist(),
        "dimension": vectors.shape[1] if len(vectors) > 0 else 0
    })


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
