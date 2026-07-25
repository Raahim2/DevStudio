import os
import re
import json
import html
import requests
from bs4 import BeautifulSoup

# Setup file paths and sources
filepath = "data/train.jsonl"
url = "https://flowbite.com/docs/forms/phone-input/" # scrape flowbite 

GEMINI_API_KEY = "GEMINI_API_KEY"  

# Must match the system prompt used in scripts/load_initial_data.py
system_prompt = (
    "You are DevStudio-1.5B, an in-editor coding assistant developed by DevStudio AI. "
    "You are a highly specialized master of modern single-file HTML and Tailwind CSS designs. "
    "Output fully functional HTML files with integrated Tailwind CSS via CDN, and provide "
    "zero extra explanation outside the code blocks."
)

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

def generate_fallback_prompt(html_code):
    """Heuristic fallback prompt generator if the Gemini API call fails or is not configured."""
    html_lower = html_code.lower()
    if "data-dismiss-target" in html_lower or "close" in html_lower:
        return "Create an interactive dismissible status alert component with a close button using HTML and Tailwind CSS."
    elif "svg" in html_lower:
        return "Design a modern status alert component featuring a warning or info icon using HTML and Tailwind CSS."
    elif "border" in html_lower:
        return "Design a set of responsive bordered status alerts (info, warning, danger, success) using HTML and Tailwind CSS."
    elif "list" in html_lower or "<ul" in html_lower:
        return "Design a detailed responsive list-style status alert layout with custom bullets, styled text, and background containers using HTML and Tailwind CSS."
    elif "additional-content" in html_lower or "read more" in html_lower:
        return "Design a rich, multi-paragraph alert panel containing additional helper text, inline links, and action buttons in HTML and Tailwind CSS."
    
    return "Design a set of responsive warning, info, danger, and success alert components with rounded corners using HTML and Tailwind CSS."

def generate_prompt_via_gemini(html_code, api_key):
    """Calls Gemini API to generate a precise prompt corresponding to the specific HTML/Tailwind styling."""
    if not api_key or api_key == "YOUR_GEMINI_API_KEY":
        return None
        
    # Using Gemini 1.5 Flash for rapid and cost-effective text generation
    endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key={api_key}"
    headers_api = {"Content-Type": "application/json"}
    
    prompt_instruction = (
        "You are an expert annotation assistant building a fine-tuning dataset for an HTML generation model. "
        "Review the HTML code provided below, which contains styled status alert elements using Tailwind CSS. "
        "Your task is to draft a natural, direct, and concise request (1 to 2 sentences) that a developer would write to get this exact output. "
        "Highlight specific layout characteristics, custom styles (like colored borders, brand-colored backgrounds, soft alert elements), "
        "and details such as icons, dismissible close buttons, bullet lists, or inline action elements. "
        "Strictly return ONLY the plain text prompt. Do not write any preambles, markdown formatting, or quotes around the prompt.\n\n"
        f"HTML snippet to convert into a user prompt:\n```html\n{html_code}\n```"
    )
    
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt_instruction}
                ]
            }
        ]
    }
    
    try:
        response = requests.post(endpoint, headers=headers_api, json=payload, timeout=12)
        if response.status_code == 200:
            res_data = response.json()
            generated_text = res_data["candidates"][0]["content"]["parts"][0]["text"]
            return generated_text.strip()
        else:
            print(f"Gemini API Error [{response.status_code}]: {response.text}")
            return None
    except Exception as e:
        print(f"Failed to communicate with Gemini API: {e}")
        return None

print(f"Fetching raw Flowbite Alert documentation from: {url}")
response = requests.get(url, headers=headers)

if response.status_code != 200:
    print(f"Could not reach page. HTTP Status: {response.status_code}")
else:
    soup = BeautifulSoup(response.text, "html.parser")
    
    # Locate documentation code content blocks
    raw_blocks = []
    for pre in soup.find_all("pre"):
        code_tag = pre.find("code")
        if code_tag:
            code_text = code_tag.get_text()
        else:
            code_text = pre.get_text()
        
        cleaned = code_text.strip()
        if cleaned and cleaned not in raw_blocks:
            raw_blocks.append(cleaned)
            
    for code_tag in soup.find_all("code"):
        cleaned = code_tag.get_text().strip()
        if cleaned and cleaned not in raw_blocks:
            raw_blocks.append(cleaned)

    # Filter for valid, pure HTML structures
    html_blocks = []
    for code in raw_blocks:
        # Check standard layout markers
        if not code.startswith("<") or not code.endswith(">"):
            continue
            
        # Ignore configuration, setup scripts or JS-based UI library templates
        if any(keyword in code for keyword in ["className=", "export default", "import ", "const ", "let ", "function "]):
            if not ("<script" in code or "<style" in code):
                continue
                
        # Confirm it references standard flowbite/banner elements
        html_blocks.append(code)

    print(f"Found {len(html_blocks)} pure HTML bottom-navigation code layouts.")
    
    # Set up destination output directory
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    appended_count = 0
    
    for idx, raw_html in enumerate(html_blocks):
        clean_html_code = raw_html.strip()
        if len(clean_html_code) < 50:
            continue
            
        # Construct single-file wrapper
        cdn_wrapped_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/flowbite@2.3.0/dist/flowbite.min.js"></script>
  <script>
    tailwind.config = {{
      darkMode: 'class',
      theme: {{
        extend: {{
          colors: {{
            brand: {{
              soft: '#EBF5FF',
              softer: '#EFF6FF',
              medium: '#3B82F6',
              strong: '#1E40AF',
              DEFAULT: '#1A56DB',
              subtle: '#BFDBFE',
            }},
            fg: {{
              brand: {{
                strong: '#1E40AF',
              }},
              danger: {{
                strong: '#9B1C1C',
              }},
              success: {{
                strong: '#03543F',
              }},
              warning: '#92400E',
              disabled: '#9CA3AF',
            }},
            danger: {{
              soft: '#FDE8E8',
              subtle: '#FBD5D5',
            }},
            success: {{
              soft: '#DEF7EC',
              subtle: '#BCF0DA',
            }},
            warning: {{
              soft: '#FEF3C7',
              subtle: '#FCE8E6',
            }},
            neutral: {{
              'secondary-medium': '#F3F4F6',
              'primary-soft': '#F9FAFB',
            }},
            heading: '#111827',
            body: '#4B5563',
          }},
          borderRadius: {{
            base: '0.5rem',
          }}
        }}
      }}
    }}
  </script>
</head>
<body class="bg-neutral-50 dark:bg-neutral-950 min-h-screen flex items-center justify-center p-6">
  <div class="max-w-xl w-full">
    {clean_html_code}
  </div>
</body>
</html>"""

        # Generate prompt using Gemini or fall back dynamically if needed
        print(f"[{idx+1}/{len(html_blocks)}] Generating prompt...")
        prompt = generate_prompt_via_gemini(clean_html_code, GEMINI_API_KEY)
        
        if not prompt:
            # Fall back to heuristic generator if Gemini fails or key is missing
            prompt = generate_fallback_prompt(clean_html_code)
            print("  -> Using heuristic fallback prompt.")
        else:
            print(f"  -> Gemini generated: \"{prompt}\"")
        
        dataset_entry = {
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt},
                {"role": "assistant", "content": f"```html\n{cdn_wrapped_html.strip()}\n```"}
            ]
        }
        
        # Append formatted structure directly to dataset 
        with open(filepath, "a", encoding="utf-8") as f:
            f.write(json.dumps(dataset_entry) + "\n")
            
        appended_count += 1

    print(f"\nFinished processing! Appended {appended_count} examples directly into '{filepath}'.")