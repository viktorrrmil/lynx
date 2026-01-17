from flask import Flask, request, jsonify
from sentence_transformers import SentenceTransformer

app = Flask(__name__)
model = SentenceTransformer("all-MiniLM-L6-v2")

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

    vectors = []

    for text in texts:
        vec = model.encode(text)
        vectors.append(vec.tolist())

    return jsonify({
        "batch_embedding": vectors,
        "dimension": len(vectors[0]) if vectors else 0
    })


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)