# scripts/split_dataset.py
import os
import random
import json

source_file = "data/train.jsonl"
train_file = "data/train2.jsonl"
val_file = "data/validation.jsonl"
test_file = "data/test.jsonl"

if not os.path.exists(source_file):
    print(f"Error: Source dataset file '{source_file}' not found. Make sure you have populated data first.")
else:
    print(f"Reading dataset from: {source_file}")
    
    with open(source_file, "r", encoding="utf-8") as f:
        lines = [line.strip() for line in f if line.strip()]
        
    total_samples = len(lines)
    
    if total_samples < 10:
        print(f"Warning: Dataset only contains {total_samples} samples. It is highly recommended to have more data before partitioning.")
    else:
        # Set a deterministic seed so splits remain reproducible across runs
        random.seed(42)
        random.shuffle(lines)
        
        # Calculate split sizes (80% Train, 10% Validation, 10% Test)
        val_size = int(total_samples * 0.1)
        test_size = int(total_samples * 0.1)
        train_size = total_samples - val_size - test_size
        
        # Slice the shuffled list
        train_data = lines[:train_size]
        val_data = lines[train_size : train_size + val_size]
        test_data = lines[train_size + val_size :]
        
        # Overwrite the train.jsonl file with only the training slice
        with open(train_file, "w", encoding="utf-8") as f:
            for line in train_data:
                f.write(line + "\n")
                
        # Write validation slice
        with open(val_file, "w", encoding="utf-8") as f:
            for line in val_data:
                f.write(line + "\n")
                
        # Write test slice
        with open(test_file, "w", encoding="utf-8") as f:
            for line in test_data:
                f.write(line + "\n")
                
        print("\n--- Data Partitioning Complete ---")
        print(f"Total Source Records Processed: {total_samples}")
        print(f"Saved to '{train_file}': {len(train_data)} records (80%)")
        print(f"Saved to '{val_file}': {len(val_data)} records (10%)")
        print(f"Saved to '{test_file}': {len(test_data)} records (10%)")