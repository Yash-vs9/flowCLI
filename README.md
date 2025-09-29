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


What Problem It Solves:

Instead of juggling multiple tools for:
	•	Writing commit messages
		- A developer main confusion is what commit message to write, so this feature solves it quite accurately using AI.
	•	Checking dependencies for vulnerabilities
		- If you want to check whether your dependencies are safe and upto date then this feature comes in clutch.
	•	Tracking productivity/active time
		- If you want to track the amount of time you have spent coding, this tool is perfect for you.
	•	Debugging APIs
		-It can perform all HTTP request so a developer can integrate it in his workflow.
	•	Finding large files
		-Want to check for duplicate or large files? This tool is for you.
		
 flowCLI combines everything into one powerful CLI tool, enhanced with AI assistance.

