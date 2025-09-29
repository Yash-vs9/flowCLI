# FlowCLI 

An AI-powered developer CLI assistant that simplifies your workflow.
It integrates with OpenAI, helps generate commit messages, scans dependencies, tracks active time, analyzes API responses, and more — all directly from your terminal.
Written in Python in just 250 Lines.

⸻

 ## Features
	•	AI-Powered Commit Messages
	•	Dependency Security Scanner
	•	Active Time Tracker
	•	API Tester
	•	Large File Finder
	•	Interactive Help

⸻

 ## Installation
	1.	Clone this repository
	2.	Install dependencies:
## Requirements:
	•	openai
	•	colorama
	•	pyfiglet
	•	yaspin
	•	inquirer
	•	requests
	•	python-dotenv
	•	pynput
	3.	Create a .env file in the project root:
OPENAI_API_KEY=your_api_key_here

⸻

Usage

Run the CLI:
```
python3 devcli.py
```

You’ll see a banner and a prompt:
```
flowCLI
Developer CLI Tool - Type 'help' for commands
devcli>
```


## What Problem It Solves

flowCLI saves developers from juggling multiple tools by combining them into one AI-powered CLI.  

Here’s what it solves point by point:  

1. **Writing Commit Messages**  
   - Developers often get confused about what commit message to write.  
   - This feature solves it by generating accurate commit messages using AI.  

2. **Checking Dependencies for Vulnerabilities**  
   - Keeps your dependencies safe and up to date.  
   - Quickly checks for vulnerabilities in your project.  

3. **Tracking Productivity / Active Time**  
   - Helps track how much time you’ve spent coding.  
   - Perfect for monitoring your workflow.  

4. **Debugging APIs**  
   - Supports all HTTP requests (GET, POST, PUT, DELETE, etc.).  
   - Lets developers integrate it directly into their workflow.  

5. **Finding Large or Duplicate Files**  
   - Detects duplicate files in your project.  
   - Finds large files that may bloat your repo.  

In short: **flowCLI combines everything into one powerful CLI tool, enhanced with AI assistance.**
