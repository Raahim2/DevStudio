# DevStudio-1.5B Fine-Tuning Pipeline

A production-ready, decoupled QLoRA (Quantized Low-Rank Adaptation) Supervised Fine-Tuning pipeline designed to specialize **Qwen2.5-Coder-1.5B-Instruct** into a dedicated **HTML + Tailwind CSS** single-file layout assistant. 

Once fine-tuned, this model acts as the specialized, low-latency intelligence layer for the **DevStudio IDE** code sidebar and inline refactoring commands.

---

## 📂 Project Directory Structure

The project is structured to isolate raw data assets, scripts, configurations, and saved weights to ensure reproducibility and clean version control.

```text
QWEN-FINETUNE/
│
├── data/
│   ├── train.jsonl             # Training set (split from parsed data)
│   ├── validation.jsonl        # Validation set (for monitoring loss)
│   └── test.jsonl              # Test set (for benchmarking)
│    
│
│
├── models/
│   ├── base/                   # Cache location for base Qwen model shards
│   ├── checkpoints/            # Intermediate step-wise check-pointing
│   └── final/                  # Merged standalone 16-bit model output
│
├── configs/
│   ├── train.yaml              # Hyperparameters and trainer configurations
│   └── lora.yaml          
│
├── scripts/
│   ├── preprocess.py           # Ingestion pipeline (Scrapers, formatters)
│   ├── train.py                # SFT Training loop utilizing SFTTrainer
│   ├── evaluate.py             # Validation benchmark suite
│   ├── merge_lora.py           # Fuses base model and final adapter
│   └── inference.py            # Local play/test execution functions
│
├── logs/
│   ├── tensorboard/            # Runs directory for TensorBoard monitoring
│   └── training.log            # Verbose training logs
│
├── outputs/
│   ├── metrics.json            # Post-training loss evaluation metrics
│   ├── predictions.json        # Test-set generation predictions
│   └── loss_curve.png          # Exported PNG plot of training loss
│
├── requirements.txt            # System dependencies
└── README.md                   # Documentation
```

---

## 🛠️ Installation and Environment Setup

Before executing any script, configure your environment to prevent library version conflicts:

1. **Clone and Navigate to the Repository:**
   ```bash
   git clone https://github.com/Raahim2/DevStudio
   cd DevStudio
   cd DEVSTUDIO-CODER-1.5B
   ```

2. **Uninstall Incompatible System Packages (e.g., Google Colab fallback):**
   ```bash
   pip uninstall -y torchao
   ```

3. **Install Dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

---

## 🔄 Data Preparation & Preprocessing

The model is optimized strictly for **single-file HTML pages using Tailwind CSS via CDN**. To build this dataset:

1. Place raw assets under `data/raw/` or configure the ingestion pipeline inside `scripts/preprocess.py`.
2. The preprocess script parses structures, unescapes HTML entities, wraps raw components in the `<!DOCTYPE html>` layout template, and appends them line-by-line to `dataset.jsonl`.
3. To execute the automated preprocessing pipeline (which fetches and sanitizes real-world components from raw GitHub-hosted database sources):
   ```bash
   python scripts/preprocess.py
   ```
4. This script splits the generated raw data into `data/train.jsonl` (approx. 90%) and `data/validation.jsonl` (approx. 10%) formats.

---

## 🚀 Hyperparameters & Model Configuration

Configurations are decoupled from the code and maintained in `configs/`.

### LoRA Hyperparameters (`configs/lora.yaml`):
*   **Rank ($r$):** `16` (Balances memory consumption and adapter learnability)
*   **Alpha ($\alpha$):** `32` (Standard $2 \times r$ scaling factor)
*   **Target Modules:** `["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"]` (Aims to adapt all critical transformer projections)
*   **Dropout:** `0.05`

### SFT Configs (`configs/train.yaml`):
*   **Learning Rate:** `2e-4`
*   **Batch Size:** `2` (With `gradient_accumulation_steps=4` to simulate an effective batch of `8`)
*   **Max Sequence Length:** `2048` (To accommodate detailed static HTML files)
*   **Optimizer:** `paged_adamw_8bit` (Conserves VRAM on standard consumer GPUs)

---

## 🏋️ Fine-Tuning Execution

To start the training run, execute the `train.py` script from the project root. The script loads the base model in 4-bit precision, applies the parameter-efficient adapter config, and initiates the supervised training loop.

```bash
python scripts/train.py
```

Monitor training progress and loss curves using TensorBoard:
```bash
tensorboard --logdir logs/tensorboard/
```

The final adapter weights will be saved in `models/checkpoints/` and automatically prepared for merging.

---

## 🔗 Weight Fusion & Export (Merging LoRA)

Since 4-bit base models cannot directly merge weights, the fusion script reloads the base model in unquantized 16-bit precision, attaches the lightweight trained adapter from your training run, and consolidates them into a unified standalone weight directory.

To run the merge:
```bash
python scripts/merge_lora.py
```

The standalone, fine-tuned model will save directly to `models/final/` and is ready for local deployment.

---

## 🛠️ IDE Local Deployment (GGUF / Ollama)

To serve **DevStudio-1.5B** locally inside your custom IDE with low latency, convert the unified model to GGUF format:

1. **Clone the `llama.cpp` tools:**
   ```bash
   git clone https://github.com/ggerganov/llama.cpp.git
   pip install -r llama.cpp/requirements.txt
   ```

2. **Convert your `models/final/` directory to GGUF format (8-bit quantization):**
   ```bash
   python llama.cpp/convert_hf_to_gguf.py ./models/final/ \
       --outfile ./models/qwen-devstudio-1.5b.gguf \
       --outtype q8_0
   ```

3. **Register with Ollama:**
   Create an Ollama config file named `Modelfile` in the root directory:
   ```dockerfile
   FROM ./models/qwen-devstudio-1.5b.gguf
   TEMPLATE "{{ if .System }}<|im_start|>system\n{{ .System }}<|im_end|>\n{{ end }}{{ if .Prompt }}<|im_start|>user\n{{ .Prompt }}<|im_end|>\n{{ end }}<|im_start|>assistant\n{{ .Response }}<|im_end|>"
   PARAMETER stop "<|im_start|>"
   PARAMETER stop "<|im_end|>"
   ```

   Compile your custom local runtime engine:
   ```bash
   ollama create devstudio-1.5b -f Modelfile
   ```

Now, configure your IDE extensions (such as **Continue** or your custom extension) to direct their local autocomplete and sidebar requests to `devstudio-1.5b` over `localhost:11434`.
```
```