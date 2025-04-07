import os
import argparse
import sys

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
        "--url",
        help="Path to the repo to scan"
    )

    parser.add_argument(
        "--access_token",
        help="Your API key goes here"
    )

    parser.add_argument(
        "--notification",
        help="Your notification to push goes here"
    )


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

    elif args.task == "push_dbs":
        if not args.url:
            print("[❗ Error ] : --url is required for push_dbs")
            return
        if not args.access_token:
            print("[❗ Error ] : --access_token is required for push_dbs")
            return
        if not args.notification:
            print("[❗ Error ] : --notification is required for push_dbs")
            return
        push_dbs(args.url, args.access_token , args.access_token)



if __name__ == "__main__":
    main()
