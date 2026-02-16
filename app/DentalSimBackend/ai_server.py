import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from llama_cpp import Llama

app = Flask(__name__)
CORS(app)

MODEL_PATH = "/MODEL_FINAL_DENTAL.gguf"

print(f"Se incarca modelul pe CPU din: {MODEL_PATH}...")

try:
    llm = Llama(
        model_path=MODEL_PATH,
        n_ctx=4096,
        n_threads=4,
        verbose=False
    )
    print("Model incarcat cu succes!")
except Exception as e:
    print(f"Eroare la incrcarea modelului: {e}")
    exit(1)

@app.route('/generate', methods=['POST'])
def generate():
    data = request.json
    messages = data.get("messages", [])

    if not messages:
        return jsonify({"error": "No messages provided"}), 400

    try:
        output = llm.create_chat_completion(
            messages=messages,
            max_tokens=256,
            temperature=0.2,
            top_p=0.9
        )
        return jsonify({"generated_text": output['choices'][0]['message']['content']})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    print("Serverul AI porneste")
    app.run(host='127.0.0.1', port=5000)