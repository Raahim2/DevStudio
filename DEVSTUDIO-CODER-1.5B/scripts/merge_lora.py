# scripts/merge_lora.py
import os
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel

base_model_path = "models/base"
adapter_path = "models/final"
save_path = "models/final_merged"

# 1. Clear VRAM and trigger garbage collection to free memory
import gc
torch.cuda.empty_cache()
gc.collect()

print("Checking hardware acceleration...")
device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"Using device: {device}")

# Determine optimal dtype for weight merge
dtype = torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16
print(f"Using precision: {dtype}")

# 2. Load Base Tokenizer
print("Loading base tokenizer...")
tokenizer = AutoTokenizer.from_pretrained(base_model_path)

# 3. Load Unquantized Base Model in 16-bit
print(f"Loading unquantized base model from '{base_model_path}'...")
base_model = AutoModelForCausalLM.from_pretrained(
    base_model_path,
    torch_dtype=dtype,
    device_map=device
)

# 4. Attach the Trained Adapter to the Base Model
print(f"Loading adapter weights from '{adapter_path}'...")
peft_model = PeftModel.from_pretrained(base_model, adapter_path)

# 5. Mathematically Fuse Weights
print("Merging adapter weights with base model weights (weight fusion)...")
merged_model = peft_model.merge_and_unload()

# 6. Save Standalone Model
print(f"Saving standalone merged model directly to '{save_path}'...")
os.makedirs(save_path, exist_ok=True)
merged_model.save_pretrained(save_path)
tokenizer.save_pretrained(save_path)

print("\n--- Weight Merge Complete ---")
print(f"Your custom standalone model weights are saved cleanly inside: '{save_path}/'")