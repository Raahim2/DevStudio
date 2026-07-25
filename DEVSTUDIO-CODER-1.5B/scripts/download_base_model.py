# scripts/download_base_model.py
import os
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM

model_id = "Qwen/Qwen2.5-Coder-1.5B-Instruct"
save_directory = "models/base"

print(f"Starting download of '{model_id}' from Hugging Face...")

# Ensure output directory exists
os.makedirs(save_directory, exist_ok=True)

# 1. Download and save the tokenizer files flat to models/base/
print("\nDownloading tokenizer files...")
tokenizer = AutoTokenizer.from_pretrained(model_id)

print(f"Saving tokenizer files directly to: {save_directory}")
tokenizer.save_pretrained(save_directory)

# 2. Download and save the model weights flat to models/base/
print("\nDownloading model weights (approx. 3.1 GB)...")
model = AutoModelForCausalLM.from_pretrained(
    model_id,
    torch_dtype=torch.float16,  # Baseline FP16 storage type
    device_map="cpu"            # Load on CPU to avoid using VRAM
)

print(f"Saving model weight shards directly to: {save_directory}...")
model.save_pretrained(save_directory)

print("\n--- Download and Saving Complete ---")
print(f"Your unquantized baseline weights are stored cleanly inside: '{save_directory}/'")