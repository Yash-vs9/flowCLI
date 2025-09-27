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

init(autoreset=True)
load_dotenv()
if not os.getenv("OPENAI_API_KEY"):
    print(f"{Fore.RED}ERROR: OPENAI_API_KEY not found. Put it in .env{Style.RESET_ALL}")
    sys.exit(1)
client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def banner(): print(f"{Fore.MAGENTA}{pyfiglet.figlet_format('devcli', font='slant')}{Style.RESET_ALL}")
def log_ok(msg): print(f"{Fore.GREEN}{msg}{Style.RESET_ALL}")
def log_info(msg): print(f"{Fore.CYAN}{msg}{Style.RESET_ALL}")
def log_warn(msg): print(f"{Fore.YELLOW}{msg}{Style.RESET_ALL}")
def log_err(msg): print(f"{Fore.RED}{msg}{Style.RESET_ALL}")

async def ask_ai(prompt, sys_prompt="You are a helpful developer assistant.", max_tokens=400):
    try:
        response = client.chat.completions.create(model="gpt-4o-mini",messages=[{"role":"system","content":sys_prompt},{"role":"user","content":prompt}],max_tokens=max_tokens,temperature=0.2)
        return response.choices[0].message.content.strip() if response.choices else ""
    except Exception as e: raise Exception(f"AI request failed: {str(e)}")

def run_cmd(cmd, cwd=None):
    try:
        result = subprocess.run(cmd, shell=True, cwd=cwd, capture_output=True, text=True)
        return result.stdout.strip(), result.stderr.strip(), result.returncode
    except Exception as e: return "", str(e), 1

async def feature_commit():
    log_info("\nAI Commit Message Generator")
    repo_path = Path(inquirer.prompt([inquirer.Text('repo_path', message="Git repo path (empty=current)", default=os.getcwd())])['repo_path']).resolve()
    if not (repo_path / ".git").exists():
        log_warn("⚠ No Git repository found.")
        if inquirer.prompt([inquirer.Confirm('init', message="Initialize git repo?", default=False)])['init']:
            stdout, stderr, code = run_cmd("git init", cwd=repo_path)
            if code == 0: log_ok("✅ Git repo initialized.")
            else: log_err(f"❌ Failed: {stderr}"); return
        else: log_err("Aborting."); return
    
    stdout, stderr, code = run_cmd("git diff --cached --unified=0", cwd=repo_path)
    diff = stdout.strip()
    if not diff:
        log_warn("No staged changes found.")
        if not inquirer.prompt([inquirer.Confirm('confirm', message="Paste diff manually?", default=False)])['confirm']: return
        diff = inquirer.prompt([inquirer.Text('manual_diff', message="Paste diff:")])['manual_diff'] or ""
        if not diff: log_err("No input. Aborting."); return

    with yaspin(text="🤔 Generating...", spinner="dots") as s:
        try:
            prompt = f"""You are an expert developer following conventional commits.
Given the git diff below, produce:
1) conventional commit title (max 72 chars)
2) 2-3 line body explaining why
3) optional footer

Diff:
```
{diff}
```

Format:
<type>(<scope>): <title>

<body>

<footer>"""
            ai_text = await ask_ai(prompt, "Conventional commit assistant.", 220)
            s.ok("✅ Generated.")
            print(f"\n{Style.BRIGHT}--- Suggested Commit ---{Style.RESET_ALL}")
            print(ai_text)
            print(f"{Style.BRIGHT}------------------------{Style.RESET_ALL}\n")
            
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
                    if code == 0: log_ok("✅ Committed.")
                    else: log_err(f"❌ Failed: {stderr}")
                except Exception as e: log_err(f"❌ Error: {e}")
        except Exception as e: s.fail("❌ Failed."); log_err(str(e))

async def feature_docs():
    log_info("\nREADME / Doc Generator")
    mode = inquirer.prompt([inquirer.List('mode', message="Generate from:", choices=[('package.json', 'pkg'),('Source file', 'file'),('Manual input', 'manual')])])['mode']
    content = ""
    
    if mode == "pkg":
        pkg_path = Path("./package.json")
        if not pkg_path.exists(): log_warn("No package.json."); content = inquirer.prompt([inquirer.Editor('manual', message="Paste content:")])['manual']
        else: content = pkg_path.read_text()
    elif mode == "file":
        file_path = Path(inquirer.prompt([inquirer.Text('path', message="File path:", default="index.js")])['path'])
        if not file_path.exists(): log_warn("File not found."); content = inquirer.prompt([inquirer.Editor('manual', message="Paste content:")])['manual']
        else: content = file_path.read_text()
    else: content = inquirer.prompt([inquirer.Editor('manual', message="Paste description:")])['manual']
    
    kind = inquirer.prompt([inquirer.List('kind', message="Generate what?", choices=["Project README", "Function docs", "API examples"])])['kind']
    
    with yaspin(text="🧠 Generating...", spinner="dots") as s:
        try:
            prompts = {"Project README": f"Create README with features, install, usage, config:\n```\n{content}\n```",
                      "Function docs": f"Add JSDoc comments to functions:\n```\n{content}\n```",
                      "API examples": f"Create API usage examples:\n```\n{content}\n```"}
            ai_text = await ask_ai(prompts[kind], "Technical writer", 600)
            s.ok("✅ Generated.")
            print(f"\n{Style.BRIGHT}--- Generated Docs ---{Style.RESET_ALL}\n{ai_text}\n{Style.BRIGHT}----------------------{Style.RESET_ALL}\n")
            
            if inquirer.prompt([inquirer.Confirm('save', message="Save to file?", default=True)])['save']:
                filename = "README.md" if kind == "Project README" else inquirer.prompt([inquirer.Text('fname', message="Filename:", default="DOCS.md" if "docs" in kind else "API.md")])['fname']
                Path(filename).write_text(ai_text)
                log_ok(f"Saved to {filename}")
        except Exception as e: s.fail("❌ Failed."); log_err(str(e))

def try_regex(pattern, flags, text):
    try:
        flag_int = 0
        if 'i' in flags: flag_int |= re.IGNORECASE
        if 'm' in flags: flag_int |= re.MULTILINE  
        if 's' in flags: flag_int |= re.DOTALL
        return {"ok": True, "matches": re.compile(pattern, flag_int).findall(text)}
    except Exception as e: return {"ok": False, "error": str(e)}

async def feature_regex():
    log_info("\nRegex Helper")
    spec = inquirer.prompt([inquirer.Text('spec', message="Describe regex need:")])['spec']
    examples = inquirer.prompt([inquirer.Text('examples', message="Example strings (comma/semicolon separated):")])['examples']
    
    with yaspin(text="🧠 Creating regex...", spinner="dots") as s:
        try:
            prompt = f"""Generate regex for: {spec}
Examples: {examples}
Provide:
- Pattern (no slashes)
- Flags (i,g,m or none)  
- Brief explanation
- Python usage"""
            ai_resp = await ask_ai(prompt, "Regex expert", 220)
            s.ok("✅ Generated.")
            print(f"\n{Style.BRIGHT}--- AI Suggestion ---{Style.RESET_ALL}\n{ai_resp}\n{Style.BRIGHT}---------------------{Style.RESET_ALL}\n")
            
            pattern, flags = None, ""
            fence_match = re.search(r'```(?:regex|python)?\s*/?(.+?)/([gimsux]*)\s*```', ai_resp, re.DOTALL)
            if fence_match: pattern, flags = fence_match.group(1).strip(), fence_match.group(2) or ""
            else:
                slash_match = re.search(r'/(.+?)/([gimsux]*)', ai_resp)
                if slash_match: pattern, flags = slash_match.group(1), slash_match.group(2) or ""
                else: pattern = ai_resp.split('\n')[0].strip()
            
            if inquirer.prompt([inquirer.Confirm('test', message="Test with examples?", default=True)])['test']:
                test_strings = [s.strip() for s in re.split('[,;]+', examples) if s.strip()]
                result = try_regex(pattern, flags, ' '.join(test_strings))
                if not result["ok"]: log_err(f"Invalid: {result['error']}")
                else: print(f"{Style.BRIGHT}Matches:{Style.RESET_ALL}\n{result['matches']}")
        except Exception as e: s.fail("❌ Failed."); log_err(str(e))

async def feature_api():
    log_info("\nAPI Tester")
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
    
    with yaspin(text="🌐 Calling...", spinner="dots") as s:
        try:
            response = requests.request(method=method, url=url, headers=headers, json=data if isinstance(data,dict) else None, data=data if isinstance(data,str) else None, timeout=20)
            s.ok(f"✅ {response.status_code} {response.reason}")
            
            body_text = response.text
            print(f"{Fore.WHITE}{body_text[:3000]}{'...(truncated)' if len(body_text)>3000 else ''}{Style.RESET_ALL}")
            
            with yaspin(text="🧠 AI analyzing...", spinner="dots") as ai_s:
                try:
                    summary = await ask_ai(f"Analyze HTTP response:\nStatus: {response.status_code}\nBody: ```{body_text[:4000]}```\nProvide 2-line summary.", "Backend debugger", 360)
                    ai_s.ok("✅ Analysis ready.")
                    print(f"\n{Style.BRIGHT}--- AI Analysis ---{Style.RESET_ALL}\n{summary}\n{Style.BRIGHT}-------------------{Style.RESET_ALL}\n")
                except Exception as e: ai_s.fail("❌ AI failed."); log_err(str(e))
        except Exception as e: s.fail("❌ Failed."); log_err(str(e))

async def main():
    banner()
    print("DEBUG: Starting main menu")  # Add this to test if main runs

    while True:
        cmd = inquirer.prompt([inquirer.List('cmd', message="Choose tool:", choices=[('Commit message (AI)','commit'),('README/Docs generator','docs'),('Regex helper','regex'),('API tester','api'),('Exit','exit')])])['cmd']
        if cmd == 'commit': await feature_commit()
        elif cmd == 'docs': await feature_docs()
        elif cmd == 'regex': await feature_regex()
        elif cmd == 'api': await feature_api()
        elif cmd == 'exit': log_ok("\n👋 Goodbye."); break

if __name__ == "__main__": 
    try: asyncio.run(main())
    except Exception as e: log_err(f"Fatal: {e}"); sys.exit(1)