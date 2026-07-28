# scripts/run_local_tuned.py
import os
import sys
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM

model_path = "models/final_merged_model"

# Ensure the local merged model directory exists and has files in it
if not os.path.exists(model_path) or not os.listdir(model_path):
    print(f"Error: Fine-tuned model directory '{model_path}' is empty or not found.")
    print("Please ensure you have extracted your merged model zip into 'models/final_merged/'.")
    sys.exit(1)

# 1. Hardware Detection
print("Checking local hardware acceleration...")
device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"Using device: {device}")

# Determine optimal data type based on hardware
if device == "cuda":
    # Use FP16/BF16 on GPU to save memory and increase speed
    dtype = torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16
else:
    # Standard FP32 is the safest datatype for general CPUs
    dtype = torch.float32

# 2. Load Tokenizer and Model
print(f"\nLoading fine-tuned DevStudio-1.5B from '{model_path}'...")
tokenizer = AutoTokenizer.from_pretrained(model_path)

# Load model (without device_map to bypass 'accelerate' package requirements)
model = AutoModelForCausalLM.from_pretrained(
    model_path,
    torch_dtype=dtype
)
model.to(device)

print("DevStudio-1.5B is loaded and ready.")

# 3. Define the specialized DevStudio system prompt
system_prompt = (
    "You are DevStudio-1.5B, an in-editor coding assistant developed by DevStudio AI. "
    "You are a highly specialized master of modern single-file HTML and Tailwind CSS designs. "
    "Output fully functional HTML files with integrated Tailwind CSS via CDN, and provide "
    "zero extra explanation outside the code blocks."
)

# 4. Interactive Terminal Loop
print("\n" + "="*50)
print("       DevStudio-1.5B Local Playground")
print("="*50)
print("Type your layout prompt and press Enter.")
print("Type 'exit' or 'quit' to close.")

while True:
    try:
        user_prompt = input("\nEnter prompt: ").strip()
        if not user_prompt:
            continue
        if user_prompt.lower() in ["exit", "quit"]:
            print("Exiting playground...")
            break
            
        # Structure inputs into the ChatML schema the model was trained on
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]
        
        prompt = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
        
        print("\nGenerating layout...")
        with torch.no_grad():
            outputs = model.generate(
                **inputs,
                max_new_tokens=1024,   # High token limit for complete HTML structures
                temperature=0.2,       # Low temperature keeps code generation precise
                do_sample=True,
                eos_token_id=tokenizer.eos_token_id
            )
            
        generated_ids = outputs[0][inputs["input_ids"].shape[1]:]
        response = tokenizer.decode(generated_ids, skip_special_tokens=True)
        
        # Display the output
        print("\n" + "="*80)
        print("DEVSTUDIO-1.5B OUTPUT:")
        print("="*80)
        print(response)
        print("="*80)
        
    except KeyboardInterrupt:
        print("\nExiting...")
        break