# scripts/inference.py
import os
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM

model_path = "../models/base"

# Ensure the local base directory actually exists
if not os.path.exists(model_path) or not os.listdir(model_path):
    print(f"Error: Base model directory '{model_path}' is empty or not found.")
    print("Please run 'python scripts/download_base_model.py' first.")
    exit(1)

# 1. Hardware Detection
print("Checking local hardware acceleration...")
device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"Using device: {device}")

# Determine optimal data type based on hardware
if device == "cuda":
    # Use FP16/BF16 on GPU to save memory and increase generation speed
    dtype = torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16
else:
    # Standard FP32 is the most stable and compatible datatype for general CPUs
    dtype = torch.float32

# 2. Load Tokenizer and Model
print(f"\nLoading baseline model and tokenizer from '{model_path}'...")
tokenizer = AutoTokenizer.from_pretrained(model_path)

# Loading without device_map="auto" removes the requirement for 'accelerate'
model = AutoModelForCausalLM.from_pretrained(
    model_path,
    torch_dtype=dtype
)
model.to(device)

print("Model is loaded and ready for query.")

# 3. Define test inputs (using your specialized DevStudio system prompt)
test_messages = [
    {
        "role": "system", 
        "content": "You are DevStudio-1.5B, an in-editor coding assistant developed by DevStudio AI. You are a highly specialized master of modern single-file HTML and Tailwind CSS designs. Output fully functional HTML files with integrated Tailwind CSS via CDN, and provide zero extra explanation outside the code blocks."
    },
    {
        "role": "user", 
        "content": "Write a clean HTML navigation bar containing a logo and three links using Tailwind CSS."
    }
]

# 4. Format inputs using Qwen's ChatML template
prompt = tokenizer.apply_chat_template(test_messages, tokenize=False, add_generation_prompt=True)
inputs = tokenizer(prompt, return_tensors="pt").to(model.device)

# 5. Generate Response
print("\n--- GENERATING BASE MODEL RESPONSE ---")
with torch.no_grad():
    outputs = model.generate(
        **inputs,
        max_new_tokens=300,
        temperature=0.3,  # Low temperature keeps code generation precise
        do_sample=True,
        eos_token_id=tokenizer.eos_token_id
    )

# 6. Extract and decode the generated token slice
generated_ids = outputs[0][inputs["input_ids"].shape[1]:]
response = tokenizer.decode(generated_ids, skip_special_tokens=True)

print(response)