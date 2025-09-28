#!/usr/bin/env python3
import os,sys,json,asyncio,subprocess,re
from pathlib import Path
import inquirer
from colorama import init,Fore,Style
import pyfiglet
from yaspin import yaspin
from dotenv import load_dotenv
import openai
import requests
from pynput import keyboard
import threading, time

init(autoreset=True)
load_dotenv()
if not os.getenv("OPENAI_API_KEY"):
    print(f"{Fore.RED}ERROR: OPENAI_API_KEY not found. Put it in .env{Style.RESET_ALL}")
    sys.exit(1)
client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
active_time = 0      # in seconds
last_active = time.time()
tracking = False
def banner(): print(f"{Fore.MAGENTA}{pyfiglet.figlet_format('flowCLI', font='slant')}{Style.RESET_ALL}")
def log_ok(msg): print(f"{Fore.GREEN}{msg}{Style.RESET_ALL}")
def log_info(msg): print(f"{Fore.CYAN}{msg}{Style.RESET_ALL}")
def log_warn(msg): print(f"{Fore.YELLOW}{msg}{Style.RESET_ALL}")
def log_err(msg): print(f"{Fore.RED}{msg}{Style.RESET_ALL}")

async def ask_ai(prompt, sys_prompt="You are a helpful developer assistant.", max_tokens=400):
    try:
        response = client.chat.completions.create(model="gpt-4o-mini",messages=[{"role":"system","content":sys_prompt},{"role":"user","content":prompt}],max_tokens=max_tokens,temperature=0.2)
        return response.choices[0].message.content.strip() if response.choices else ""
    except Exception as e: raise Exception(f"AI request failed: {str(e)}")
def on_key_press(key):
    global last_active
    last_active = time.time()

def start_tracking():
    global tracking
    if tracking: return
    tracking = True
    listener = keyboard.Listener(on_press=on_key_press)
    listener.daemon = True
    listener.start()

    def timer():
        global active_time, last_active
        while tracking:
            if time.time() - last_active < 60:  
                active_time += 1
            time.sleep(1)

    threading.Thread(target=timer, daemon=True).start()
def run_cmd(cmd, cwd=None):
    try:
        result = subprocess.run(cmd, shell=True, cwd=cwd, capture_output=True, text=True)
        return result.stdout.strip(), result.stderr.strip(), result.returncode
    except Exception as e: return "", str(e), 1

def show_help():
    help_text = f"""{Style.BRIGHT}Available Commands:{Style.RESET_ALL}
{Fore.CYAN}commit{Style.RESET_ALL}    - Generate AI-powered commit messages
{Fore.CYAN}security{Style.RESET_ALL}  - Scan dependencies for vulnerabilities
{Fore.CYAN}api{Style.RESET_ALL}       - Test APIs with AI analysis
{Fore.CYAN}help{Style.RESET_ALL}      - Show this help message
{Fore.CYAN}scanfile{Style.RESET_ALL}  - Scan for large files
{Fore.CYAN}track{Style.RESET_ALL}     - Track active time
{Fore.CYAN}exit{Style.RESET_ALL}      - Exit the CLI

{Style.BRIGHT}Usage:{Style.RESET_ALL} Type a command and press Enter"""
    print(help_text)

async def feature_commit():
    log_info("\nAI Commit Message Generator")
    repo_path = Path(inquirer.prompt([inquirer.Text('repo_path', message="Git repo path (empty=current)", default=os.getcwd())])['repo_path']).resolve()
    if not (repo_path / ".git").exists():
        log_warn("⚠ No Git repository found.")
        if inquirer.prompt([inquirer.Confirm('init', message="Initialize git repo?", default=False)])['init']:
            stdout, stderr, code = run_cmd("git init", cwd=repo_path)
            if code == 0: log_ok("Git repo initialized.")
            else: log_err(f" Failed: {stderr}"); return
        else: log_err("Aborting."); return
    
    stdout, stderr, code = run_cmd("git diff --cached --unified=0", cwd=repo_path)
    diff = stdout.strip()
    if not diff:
        log_warn("No staged changes found.")
        if not inquirer.prompt([inquirer.Confirm('confirm', message="Paste diff manually?", default=False)])['confirm']: return
        diff = inquirer.prompt([inquirer.Text('manual_diff', message="Paste diff:")])['manual_diff'] or ""
        if not diff: log_err("No input. Aborting."); return

    with yaspin(text="Generating...", spinner="dots") as s:
        try:
            prompt = f"""Generate conventional commit message for this diff:
```
{diff}
```
Format: <type>(<scope>): <title>
<body>
"""
            ai_text = await ask_ai(prompt, "Conventional commit assistant.", 200)
            print(f"\n{Style.BRIGHT}--- Suggested Commit ---{Style.RESET_ALL}")
            print(ai_text)
            answers = inquirer.prompt([inquirer.Confirm('use', message=f"Commit in {repo_path}?", default=False),inquirer.Confirm('copy', message="Copy to clipboard?", default=False)])
            if answers['copy']:
                try: subprocess.run(['pbcopy'], input=ai_text, text=True); log_ok("✅ Copied.")
                except: log_warn("⚠ Copy failed.")
            if answers['use']:
                try:
                    tmp = repo_path / ".devcli_tmp"
                    tmp.write_text(ai_text)
                    stdout, stderr, code = run_cmd(f'git commit --no-verify -F "{tmp}"', cwd=repo_path)
                    tmp.unlink()
                    if code == 0: log_ok(" Committed.")
                except Exception as e: log_err(f"Error: {e}")
        except Exception as e: s.fail(" Failed.")
        log_err(str(e))
async def feature_track():
    global tracking
    log_info("\n⏱️ Active Time Tracker")
    start_tracking()
    log_info("Tracking keyboard activity... Press Ctrl+C to stop.\n")
    try:
        while True:
            mins, secs = divmod(active_time, 60)
            hrs, mins = divmod(mins, 60)
            print(f"\r🕒 Active Time: {int(hrs):02}:{int(mins):02}:{int(secs):02}", end="")
            time.sleep(1)
    except KeyboardInterrupt:
        tracking = False  
        mins, secs = divmod(active_time, 60)
        hrs, mins = divmod(mins, 60)
        log_ok(f"\nTotal Active Time: {int(hrs)}h {int(mins)}m {int(secs)}s")
async def feature_scanfiles():
    log_info("\nLarge File Finder")
    scan_path = Path(inquirer.prompt([inquirer.Text('path', message="Project path (empty=current)", default=os.getcwd())])['path']).resolve()
    threshold_mb = inquirer.prompt([inquirer.Text('thresh', message="Minimum large file size (MB, default=5)", default="5")])['thresh']
    try:size_threshold = int(float(threshold_mb) * 1024 * 1024)
    except: size_threshold = 5 * 1024 * 1024

    large_files = []
    log_info(f"Scanning {scan_path} for files larger than {size_threshold // (1024*1024)} MB...")

    with yaspin(text="Scanning files...", spinner="dots") as s:
        try:
            for root, dirs, files in os.walk(scan_path):
                for fname in files:
                    try:
                        fpath = Path(root) / fname
                        if not fpath.is_file():
                            continue
                        fsize = fpath.stat().st_size
                        if fsize >= size_threshold:
                            large_files.append((str(fpath), fsize))
                    except:
                        continue
            s.ok("Scan complete.")
        except Exception as e:
            s.fail(f"Scan error: {e}"); return

    print(f"\n{Style.BRIGHT}Large files (>{size_threshold // (1024*1024)} MB):{Style.RESET_ALL}")
    if large_files:
        for f, sz in sorted(large_files, key=lambda x: -x[1]):
            print(f"{f} ({sz // (1024*1024)}MB)")
    else: print("No large files found.")

async def feature_security():
    log_info("\n🔐 Dependency Security Scanner")
    scan_path = Path(inquirer.prompt([inquirer.Text('path', message="Project path (empty=current)", default=os.getcwd())])['path']).resolve()

    package_files = [f for f in ['package.json', 'requirements.txt', 'Pipfile', 'pom.xml', 'build.gradle'] if (scan_path / f).exists()]
    if not package_files: return log_warn("No package files found (package.json, requirements.txt, etc.)")

    log_info(f"Found package files: {', '.join(package_files)}")

    dependencies_summary = []

    with yaspin(text="Reading dependencies...", spinner="dots") as s:
        try:
            for file in package_files:
                file_path = scan_path / file
                content = file_path.read_text()

                if file == 'package.json':
                    try:
                        pkg_data = json.loads(content)
                        deps = {**pkg_data.get('dependencies', {}), **pkg_data.get('devDependencies', {})}
                        for name, version in deps.items():
                            dependencies_summary.append(f"{name}@{version}")
                    except Exception as e:
                        log_warn(f"Failed to parse package.json: {e}")

                elif file == 'requirements.txt':
                    lines = [line.strip() for line in content.split('\n') if line.strip() and not line.startswith('#')]
                    for line in lines:
                        dependencies_summary.append(line)

            if not dependencies_summary: return (s.fail(" No dependencies found in package files.") or None)

            s.ok(" Dependencies loaded, sending to AI...")

            deps_text = "\n".join(dependencies_summary)
            prompt = f"You are a consice assistant, dont use more than 80 tokens. Given the following list of project dependencies:\n``````\nAnalyze this list for any security vulnerabilities or risks. Provide the name of those dependency which are at risk. here are the dependency {deps_text}"

            with yaspin(text="AI analyzing dependencies...", spinner="dots") as ai_s:
                try:
                    analysis = await ask_ai(prompt, "Security expert", 600)
                    ai_s.ok("✅ AI analysis completed.")
                    print(f"\n{Style.BRIGHT}--- Security Analysis ---{Style.RESET_ALL}\n{analysis}\n{Style.BRIGHT}-------------------------{Style.RESET_ALL}\n")
                except Exception as e:ai_s.fail(" AI analysis failed.");log_err(str(e))

        except Exception as e: s.fail(" Failed to read dependencies.");log_err(str(e))
async def feature_api():
    log_info("\n API Tester")
    answers = inquirer.prompt([inquirer.List('method', message="Method:", choices=["GET","POST","PUT","PATCH","DELETE"]),inquirer.Text('url', message="URL:")])
    method, url = answers['method'], answers['url']
    
    headers = {}
    if inquirer.prompt([inquirer.Confirm('headers', message="Add headers?", default=False)])['headers']:
        try: headers = json.loads(inquirer.prompt([inquirer.Text('raw', message="Headers JSON:")])['raw'])
        except: log_warn("Invalid JSON ignored.")
    
    data = None
    if method in ["POST","PUT","PATCH"] and inquirer.prompt([inquirer.Confirm('body', message="Send body?", default=False)])['body']:
        body = inquirer.prompt([inquirer.Text('body', message="Body:")])['body']
        try: data = json.loads(body)
        except: data = body
    
    with yaspin(text=" Calling...", spinner="dots") as s:
        try:
            response = requests.request(method=method, url=url, headers=headers, json=data if isinstance(data,dict) else None, data=data if isinstance(data,str) else None, timeout=20)
            s.ok(f"✅ {response.status_code} {response.reason}")
            
            body_text = response.text
            print(f"{Fore.WHITE}{body_text[:3000]}{'...(truncated)' if len(body_text)>3000 else ''}{Style.RESET_ALL}")
            
            with yaspin(text="AI analyzing...", spinner="dots") as ai_s:
                try:
                    summary = await ask_ai(f"Analyze HTTP response:\nStatus: {response.status_code}\nBody: ```{body_text[:4000]}```\nProvide 2-line summary.", "Backend debugger", 360)
                    ai_s.ok(" Analysis ready.")
                    print(f"\n{Style.BRIGHT}--- AI Analysis ---{Style.RESET_ALL}\n{summary}\n{Style.BRIGHT}-------------------{Style.RESET_ALL}\n")
                except Exception as e: ai_s.fail(" AI failed."); log_err(str(e))
        except Exception as e: s.fail(" Failed."); log_err(str(e))

async def main():
    banner()
    log_info("Developer CLI Tool - Type 'help' for commands")
    
    commands = {
        'commit': feature_commit,
        'security': feature_security,
        'track':feature_track,
        'api': feature_api,
        'help': lambda: show_help(),
        'scanfile':feature_scanfiles
    }
    
    while True:
        try:
            cmd = input(f"\n{Fore.YELLOW}devcli>{Style.RESET_ALL} ").strip().lower()
            if cmd == 'exit': log_ok(" Goodbye!"); break
            elif cmd in commands:
                if asyncio.iscoroutinefunction(commands[cmd]):
                    await commands[cmd]()
                else:
                    commands[cmd]()
            elif cmd == '':
                continue
            else:
                log_err(f"Unknown command: {cmd}. Type 'help' for available commands.")
        except (KeyboardInterrupt, EOFError):
            break
if __name__ == "__main__": 
    try: asyncio.run(main())
    except Exception as e: log_err(f"Fatal: {e}"); sys.exit(1)