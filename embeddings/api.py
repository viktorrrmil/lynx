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

    print("Embedding text...")
    print("Text:", text)

    vec = model.encode(text)

    return jsonify({
        "embedding": vec.tolist(),
        "dimension": len(vec)
    })

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)