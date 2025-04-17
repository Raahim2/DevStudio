
# Importing all the needed libraries
import os
import argparse
import sys
import requests



# Setting up the base URL for the API

#BASE_URL = "http://127.0.0.1:5000"
BASE_URL = "http://192.168.197.116:5000"


# Function to print banner
def banner():
    return """
\033[38;5;208m
     _______                      ______   __                    __ __          
    /       \\                    /      \\ /  |                  /  /  |         
    $$$$$$$  | ______  __     __/$$$$$$  _$$ |_   __    __  ____$$ $$/  ______  
    $$ |  $$ |/      \\/  \\   /  $$ \\__$$/ $$   | /  |  /  |/    $$ /  |/      \\ 
    $$ |  $$ /$$$$$$  $$  \\ /$$/$$      $$$$$$/  $$ |  $$ /$$$$$$$ $$ /$$$$$$  |
    $$ |  $$ $$    $$ |$$  /$$/  $$$$$$  |$$ | __$$ |  $$ $$ |  $$ $$ $$ |  $$ |
    $$ |__$$ $$$$$$$$/  $$ $$/  /  \\__$$ |$$ |/  $$ \\__$$ $$ \\__$$ $$ $$ \\__$$ |
    $$    $$/$$       |  $$$/   $$    $$/ $$  $$/$$    $$/$$    $$ $$ $$    $$/ 
    $$$$$$$/  $$$$$$$/    $/     $$$$$$/   $$$$/  $$$$$$/  $$$$$$$/$$/ $$$$$$/  
\033[0m
"""


# Function to send query to the API to scan a particular repo
def send_query(url,access_token):
    payload = {
        "repo_url": url,
        "access_token": access_token
    }
    final_url = BASE_URL + '/api/send_query'
    try:
        response = requests.post(final_url , json=payload)
        response.raise_for_status()
        print(" [-] Successfully posted to server.")
        print(" [-] Server Response:", response.json())

    except requests.exceptions.RequestException as e:
        print(" [!] Failed to send query.")
        print(" Error:", str(e))


# Function to send notification to the API to sotre it
def push_notif(url,access_token,notification):
    payload = {
        "repo_url": url,
        "access_token": access_token,
        "notification": notification
    }
    final_url = BASE_URL + '/api/push_notif'
    try:
        response = requests.post(final_url , json=payload)
        response.raise_for_status()
        print(" [-] Successfully posted to server.")
        print(" [-] Server Response:", response.json())

    except requests.exceptions.RequestException as e:
        print(" [!] Failed to send query.")
        print(" Error:", str(e))


# Function to get notification for a particular access token
def get_notif(access_token):
    payload = {
        "access_token": access_token
    }
    final_url = BASE_URL + '/api/get_notif'
    try:
        response = requests.post(final_url , json=payload)
        response.raise_for_status()
        print(" [-] Successfully posted to server.")
        print(" [-] Server Response:", response.json())
    
    except requests.exceptions.RequestException as e:
        print(" [!] Failed to send query.")
        print(" Error:", str(e))

def del_notif(id):
    payload = {
        "id": id
    }
    final_url = BASE_URL + '/api/del_notif'
    try:
        response = requests.post(final_url , json=payload)
        response.raise_for_status()
        print(" [-] Successfully posted to server.")
        print(" [-] Server Response:", response.json())
    
    except requests.exceptions.RequestException as e:
        print(" [!] Failed to send query.")
        print(" Error:", str(e))


# Main function
def main():
    print(banner())

    parser = argparse.ArgumentParser(
        description="🛠️ CLI tool for scanning repos and pushing/fetching alerts for next js application"
    )

    parser.add_argument("--task", choices=["scan_repo", "push_notif", "get_notif" , "del_notif"], help="Task to perform")
    parser.add_argument("--url", type=str, help="GitHub repo URL")
    parser.add_argument("--access_token", type=str, help="GitHub access token")
    parser.add_argument("--notification", type=str, help="Notification to push")
    parser.add_argument("--id", help="Notification ID")

    args = parser.parse_args()
    
    if len(sys.argv) == 1:
        parser.print_help()
        return

    args = parser.parse_args()

    if args.task == "scan_repo":
        if not args.url:
            print("[❗ Error ] : --url is required for scan_repo")
            return
        if not args.access_token:
            print("[❗ Error ] : --access_token is required for scan_repo")
            return
        send_query(args.url, args.access_token)

    elif args.task == "push_notif":
        if not args.url:
            print("[❗ Error ] : --url is required for push_notif")
            return
        if not args.access_token:
            print("[❗ Error ] : --access_token is required for push_nofis")
            return
        if not args.notification:
            print("[❗ Error ] : --notification is required for push_notif")
            return
        push_notif(args.url, args.access_token , args.notification)
    
    elif args.task == "get_notif":
        if not args.access_token:
            print("[❗ Error ] : --access_token is required for get_notif")
            return
        get_notif(args.access_token)
    
    elif args.task == "del_notif":
        if not args.id:
            print("[❗ Error ] : --id is required for del_notif")
            return
        del_notif(args.id)
    
    else:
        print("[❗ Error ] : Invalid task specified.")
        return



if __name__ == "__main__":
    main()
