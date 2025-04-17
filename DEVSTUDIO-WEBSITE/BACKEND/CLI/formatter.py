import ast
import pprint

def format_semgrep_results(data):
    print("\n🔍 SEMGREP FINDINGS REPORT\n" + "=" * 40)
    results = data.get('findings', {}).get('results', [])

    if not results:
        print("✅ No issues found.")
        return

    for idx, issue in enumerate(results, start=1):
        path = issue.get("path", "N/A")
        check_id = issue.get("check_id", "N/A")
        message = issue.get("extra", {}).get("message", "No message provided.")
        severity = issue.get("extra", {}).get("severity", "UNKNOWN")
        line = issue.get("start", {}).get("line", "N/A")

        print(f"\n#{idx}:")
        print(f"🔹 File      : {path}")
        print(f"🔹 Line      : {line}")
        print(f"🔹 Severity  : {severity}")
        print(f"🔹 Rule ID   : {check_id}")
        print(f"🔹 Message   : {message}")
        print("-" * 40)

if __name__ == "__main__":
    with open("return.json", "r") as f:
        raw = f.read()

    try:
        # Use ast.literal_eval to safely parse Python-style dict
        data = ast.literal_eval(raw)
        format_semgrep_results(data)
    except Exception as e:
        print(f"❌ Failed to parse file: {e}")

