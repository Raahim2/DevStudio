
from flask import Flask , render_template , url_for , request , jsonify
from supabase import create_client, Client
import os
import subprocess
import json
from pathlib import Path

app = Flask(__name__)


SUPABASE_URL = "https://pyrfjucblogdhkfhzgbi.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5cmZqdWNibG9nZGhrZmh6Z2JpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NDAxMjc2MCwiZXhwIjoyMDU5NTg4NzYwfQ.R2U84xT3A8f8Qd-A8a5Nh5hV0ryTLfEXhW8rx0WxMP4"

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


# ---------------CRITICAL FUNCTIONS---------------------

def scan_repo(repo_url, access_token):
    print("[DEBUG] Starting scan for:", repo_url)

    # Step 1: Ensure ~/devstudio exists
    devstudio_path = Path.home() / "devstudio"
    if not devstudio_path.exists():
        print("[DEBUG] ~/devstudio does not exist. Creating it.")
        devstudio_path.mkdir(parents=True)
    else:
        print("[DEBUG] ~/devstudio already exists.")

    # Step 2: Prepare clone path
    repo_name = repo_url.rstrip("/").split("/")[-1].replace(".git", "")
    clone_path = devstudio_path / repo_name
    print(f"[DEBUG] Target clone path: {clone_path}")

    if clone_path.exists():
        print("[DEBUG] Repo already exists at path. Removing it for fresh clone.")
        subprocess.run(["rm", "-rf", str(clone_path)], check=True)

    # Step 3: Build authenticated repo URL
    if repo_url.startswith("https://"):
        auth_url = repo_url.replace("https://", f"https://{access_token}@")
        print("[DEBUG] Authenticated repo URL built.")
    else:
        print("[ERROR] Repo URL must start with https://")
        return {"status": "error", "message": "Repo URL must start with https://"}

    # Step 4: Clone the repo
    print("[DEBUG] Cloning the repo...")
    subprocess.run(["git", "clone", auth_url, str(clone_path)], check=True)
    print("[DEBUG] Clone complete.")

    # Step 5: Run semgrep scan
    semgrep_cmd = [
        "semgrep",
        "--config", "auto",
        "--json",
        str(clone_path)
    ]
    print("[DEBUG] Running Semgrep scan...")
    result = subprocess.run(semgrep_cmd, capture_output=True, text=True, check=True)
    print("[DEBUG] Semgrep scan complete.")

    # Step 6: Parse findings
    findings = json.loads(result.stdout)
    print("[DEBUG] Findings parsed.")

    return {
        "status": "success",
        "message": f"Scanned the repo {repo_url}",
        "findings": findings
    }


def push_database(repo_url, access_token, notification):
    try:
        data = {
            "repo_url": repo_url,
            "access_token": access_token,
            "notification": notification
        }

        response = supabase.table("notifications_table").insert(data).execute()

        result = {
            "status": "success",
            "message": f"Pushed the notification {notification}",
            "response": response.data
        }
    except Exception as e:
        result = {
            "status": "error",
            "message": str(e)
        }

    return result


def get_notifications(access_token):
    try:
        response = supabase.table("notifications_table") \
            .select("id, repo_url, notification") \
            .eq("access_token", access_token) \
            .execute()

        result = {
            "status": "success",
            "notifications": response.data
        }
    except Exception as e:
        result = {
            "status": "error",
            "message": str(e)
        }

    return result

def delete_notifications(id):
    try:
        response = supabase.table("notifications_table") \
            .delete() \
            .eq("id", id) \
            .execute()

        result = {
            "status": "success",
            "message": f"Deleted notification with ID {id}",
            "response": response.data
        }
    except Exception as e:
        result = {
            "status": "error",
            "message": str(e)
        }

    return result


# ---------------FLASK TEMPLATES------------------------

@app.route('/')
def home():
    return render_template('home.html')

@app.route('/api/send_query',methods=['POST'])
def send_query():
    if request.method == 'POST':
        data = request.get_json()

        repo_url = data.get('repo_url')
        access_token = data.get('access_token')

        if not repo_url or not access_token:
            return jsonify({"error": "Missing one of the required parameters"}), 400
        
        print(f"[-] Recieved repo : {repo_url}")
        print(f"[-] Recieved access token : {access_token}")

        return jsonify(scan_repo(repo_url,access_token)) , 200


@app.route('/api/push_notif',methods=['POST'])
def push_notif():
    if request.method == 'POST':
        data = request.get_json()

        repo_url = data.get('repo_url')
        access_token = data.get('access_token')
        notification = data.get('notification')

        if not repo_url or not access_token or not notification:
            return jsonify({"error": "Missing one of the required parameters"}), 400
        
        print(f"[-] Recieved repo : {repo_url}")
        print(f"[-] Recieved access token : {access_token}")
        print(f"[-] Recieved notification : {notification}")        

        return jsonify(push_database(repo_url,access_token,notification)) , 200


@app.route("/api/get_notif",methods=['POST'])
def get_notf():
    if request.method == "POST":
        data = request.get_json()

        access_token = data.get('access_token')

        if not access_token:
            return jsonify({"error": "Missing access token"}), 400
        
        print(f"[-] Recieved access token : {access_token}")
        return jsonify(get_notifications(access_token)),200


@app.route("/api/del_notif",methods=['POST'])
def del_notf():
    if request.method == "POST":
        data = request.get_json()

        id = data.get('id')

        if not id:
            return jsonify({"error": "Missing ID parameter"}), 400
        
        print(f"[-] Recieved notification : {id}")
        return jsonify(delete_notifications(id)),200

if __name__ == '__main__':
    app.run(debug=True)