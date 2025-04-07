import os
import argparse

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


def send_query():
    pass 

def push_dbs():
    pass 


import argparse
import sys

def main():
    print(banner())

    parser = argparse.ArgumentParser(
        description="🛠️ CLI tool for scanning repositories and pushing to databases for nextjs app",
        usage="python script.py --task {scan_repo,push_dbs} [--folder FOLDER] --api API_KEY [--devtoken DEVTOKEN]"
    )

    parser.add_argument(
        "--task",
        choices=["scan_repo", "push_dbs"],
        help="Specify the task to run"
    )

    parser.add_argument(
        "--folder",
        help="Path to the repo to scan"
    )

    parser.add_argument(
        "--api",
        help="Your API key goes here"
    )

    parser.add_argument(
        "--devtoken",
        help="Needed for the app to send queries and update the database"
    )

    # Show help if no arguments are provided
    if len(sys.argv) == 1:
        parser.print_help()
        return

    args = parser.parse_args()

    if args.task == "scan_repo":
        if not args.folder:
            print("[❗ Error ] : --folder is required for scan_repo")
            return
        if not args.api:
            print("[❗ Error ] : --api is required for scan_repo")
            return
        send_query(args.folder, args.api)

    elif args.task == "push_dbs":
        if not args.folder:
            print("[❗ Error ] : --folder is required for push_dbs")
            return
        if not args.api:
            print("[❗ Error ] : --api is required for push_dbs")
            return
        if not args.devtoken:
            print("[❗ Error ] : --devtoken is required for push_dbs")
            return
        push_dbs(args.folder, args.api, args.devtoken)



if __name__ == "__main__":
    main()
