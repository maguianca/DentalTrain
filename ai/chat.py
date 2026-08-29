import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
from peft import PeftModel

BASE_ID = "TinyLlama/TinyLlama-1.1B-Chat-v1.0"
ADAPTER_DIR = "./tinyllama_stoma_final"

bnb = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_compute_dtype=torch.float16,
    bnb_4bit_use_double_quant=True,
)

print("[INFO] Loading base model...")
base = AutoModelForCausalLM.from_pretrained(BASE_ID, quantization_config=bnb, device_map="auto")

print("[INFO] Loading LoRA adapters...")
model = PeftModel.from_pretrained(base, ADAPTER_DIR)
model.eval()

tokenizer = AutoTokenizer.from_pretrained(BASE_ID, use_fast=True)
if tokenizer.pad_token is None:
    tokenizer.pad_token = tokenizer.eos_token

# PROMPT
messages = [
    {"role": "system", "content": "Tu ești un pacient care are o problemă dentară. Nu spui diagnosticul."},
    {"role": "user", "content": "Ce vă supără cel mai mult?"}
]

prompt = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)

inputs = tokenizer(prompt, return_tensors="pt").to(model.device)

print("\n[INFO] Generating response...\n")
with torch.inference_mode():
    out = model.generate(**inputs, max_new_tokens=150, do_sample=True, temperature=0.7, top_p=0.9)

decoded = tokenizer.decode(out[0], skip_special_tokens=True)
print("🔹 OUTPUT:\n", decoded)
