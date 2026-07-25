import os
import yaml
import torch
from datasets import load_dataset
from transformers import AutoTokenizer, AutoModelForCausalLM, BitsAndBytesConfig
from peft import LoraConfig, prepare_model_for_kbit_training
from trl import SFTConfig, SFTTrainer

# 1. Load Local Configurations
print("Loading YAML configurations...")
with open("configs/train.yaml", "r") as f:
    train_config = yaml.safe_load(f)
with open("configs/lora.yaml", "r") as f:
    lora_config_dict = yaml.safe_load(f)

# Ensure checkpoints output folder exists
os.makedirs(train_config["output_dir"], exist_ok=True)

# 2. Configure 4-bit Quantization (QLoRA)
bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_compute_dtype=torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16,
    bnb_4bit_use_double_quant=True
)

# 3. Load Local Model & Tokenizer
print(f"Loading local base model from '{train_config['model_id']}'...")
tokenizer = AutoTokenizer.from_pretrained(train_config["model_id"])
tokenizer.pad_token = tokenizer.eos_token
tokenizer.padding_side = "right"  # Required for training stability

model = AutoModelForCausalLM.from_pretrained(
    train_config["model_id"],
    quantization_config=bnb_config,
    device_map="auto"
)

# 4. Apply PEFT & Prepare for 4-bit Training
print("Applying LoRA adapters...")
model = prepare_model_for_kbit_training(model)
peft_config = LoraConfig(**lora_config_dict)

# 5. Load Dataset Splits
print("Loading split datasets...")
dataset_files = {
    "train": train_config["train_file"],
    "validation": train_config["val_file"]
}
dataset = load_dataset("json", data_files=dataset_files)

# 6. Initialize Training Configurations
training_args = SFTConfig(
    output_dir=train_config["output_dir"],
    per_device_train_batch_size=train_config["per_device_train_batch_size"],
    gradient_accumulation_steps=train_config["gradient_accumulation_steps"],
    learning_rate=float(train_config["learning_rate"]),
    logging_steps=train_config["logging_steps"],
    max_length=train_config["max_length"],
    num_train_epochs=train_config["num_train_epochs"],
    optim=train_config["optim"],
    fp16=not torch.cuda.is_bf16_supported(),
    bf16=torch.cuda.is_bf16_supported(),
    save_strategy=train_config["save_strategy"],
    save_total_limit=2,           # Keeps only the latest 2 checkpoints to prevent disk full errors
    report_to=train_config["report_to"],
    eval_strategy="epoch",        # Evaluates validation loss at the end of each epoch
    logging_dir="./logs/tensorboard"
)

# 7. Initialize Trainer
trainer = SFTTrainer(
    model=model,
    train_dataset=dataset["train"],
    eval_dataset=dataset["validation"],
    peft_config=peft_config,
    processing_class=tokenizer,
    args=training_args,
)

# 8. Check for Existing Checkpoints to Auto-Resume Training
resume_checkpoint = None
if os.path.exists(train_config["output_dir"]):
    # Check if any folders inside start with "checkpoint-"
    checkpoints = [
        os.path.join(train_config["output_dir"], d)
        for d in os.listdir(train_config["output_dir"])
        if d.startswith("checkpoint-") and os.path.isdir(os.path.join(train_config["output_dir"], d))
    ]
    if checkpoints:
        # Sort checkpoints based on global steps to find the latest folder
        checkpoints.sort(key=lambda x: int(x.split("-")[-1]))
        resume_checkpoint = checkpoints[-1]

# 9. Start Fine-Tuning
print("\n--- Starting Fine-Tuning Execution ---")
if resume_checkpoint:
    print(f"Found active checkpoint. Resuming from: {resume_checkpoint}")
    trainer.train(resume_from_checkpoint=resume_checkpoint)
else:
    print("No checkpoints found. Starting a fresh training run...")
    trainer.train()

# 10. Save final adapter weights to models/final/
adapter_save_dir = "models/final"
os.makedirs(adapter_save_dir, exist_ok=True)
trainer.model.save_pretrained(adapter_save_dir)
tokenizer.save_pretrained(adapter_save_dir)

print(f"\nTraining completed! Adapter weights saved cleanly inside '{adapter_save_dir}/'")