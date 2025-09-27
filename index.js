#!/usr/bin/env node
/**
 * devcli - AI developer helper CLI
 *
 * Features:
 *  - commit  : AI Commit Message Generator (reads staged changes)
 *  - docs    : README / Doc Generator from file or package.json
 *  - regex   : Regex helper from plain-language spec
 *  - api     : API tester (calls API + AI summarizes response)
 *
 * Dependencies: openai, inquirer, chalk, figlet, ora, axios, dotenv
 * Install: npm i openai inquirer chalk figlet ora axios dotenv
 *
 * Usage: node index.js
 */

import fs from "fs/promises";
import { existsSync } from "fs";
import { exec } from "child_process";
import { promisify } from "util";
import inquirer from "inquirer";
import chalk from "chalk";
import figlet from "figlet";
import ora from "ora";
import dotenv from "dotenv";
import OpenAI from "openai";
import axios from "axios";

dotenv.config();
const execP = promisify(exec);

if (!process.env.OPENAI_API_KEY) {
  console.error(chalk.red("ERROR: OPENAI_API_KEY not found. Put it in .env"));
  process.exit(1);
}

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ----------------- Helpers -----------------
const banner = () =>
  console.log(chalk.magenta(figlet.textSync("devcli", { horizontalLayout: "full" })));

function logOk(msg) {
  console.log(chalk.green(msg));
}
function logInfo(msg) {
  console.log(chalk.cyan(msg));
}
function logWarn(msg) {
  console.log(chalk.yellow(msg));
}
function logErr(msg) {
  console.error(chalk.red(msg));
}

/**
 * askAI: wrapper to call chat completion
 * @param {string} userPrompt
 * @param {string} systemPrompt optional
 * @param {number} maxTokens optional
 */
async function askAI(userPrompt, systemPrompt = "You are a helpful developer assistant.", maxTokens = 400) {
  try {
    const response = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: maxTokens,
      temperature: 0.2,
    });
    return response.choices?.[0]?.message?.content?.trim() ?? "";
  } catch (err) {
    // surface useful error message
    const msg = err?.message ?? String(err);
    throw new Error("AI request failed: " + msg);
  }
}

// ----------------- Feature: AI Commit Message Generator -----------------
import path from "path";

async function featureCommitMessage() {
  console.log(chalk.cyan("\nAI Commit Message Generator"));

  // Ask for repo path
  const { repoPath: inputPath } = await inquirer.prompt([
    {
      type: "input",
      name: "repoPath",
      message: "Enter path to the Git repository (leave empty for current folder):",
      default: process.cwd(),
    },
  ]);

  // Normalize path
  const repoPath = path.resolve(inputPath.trim());

  // Ensure .git exists
  const gitFolderExists = await fs
    .access(path.join(repoPath, ".git"))
    .then(() => true)
    .catch(() => false);

  if (!gitFolderExists) {
    console.log(chalk.yellow("⚠ No Git repository found at this path."));
    const { initRepo } = await inquirer.prompt([
      { type: "confirm", name: "initRepo", message: "Initialize a new Git repo here?", default: false },
    ]);
    if (initRepo) {
      await execP("git init", { cwd: repoPath }); // cwd handles spaces
      console.log(chalk.green("✅ Git repository initialized."));
    } else {
      console.log(chalk.red("Aborting commit generator."));
      return;
    }
  }

  // Get staged diff
  let diff = "";
  try {
    const { stdout } = await execP("git diff --cached --unified=0", { cwd: repoPath });
    diff = stdout.trim();
  } catch {
    diff = "";
  }

  // Fallback to manual input
  if (!diff) {
    console.log(chalk.yellow("No staged changes found (git diff --cached empty)."));
    const { confirm } = await inquirer.prompt([
      {
        type: "confirm",
        name: "confirm",
        message: "Do you want to paste a diff or short description manually?",
        default: false,
      },
    ]);
    if (!confirm) return;

    const { manualDiff } = await inquirer.prompt([
      { type: "input", name: "manualDiff", message: "Paste diff or short description here:" },
    ]);
    diff = manualDiff || "";
    if (!diff) {
      console.log(chalk.red("No input provided. Aborting."));
      return;
    }
  }

  // Generate AI commit message
  const spinner = ora("🤔 Generating commit message...").start();
  try {
    const prompt = `You are an expert developer following conventional commits.
Given the staged git diff or change summary below, produce:
1) a concise conventional commit title (max 72 chars),
2) a 2-3 line body explaining why the change was made,
3) optionally a footer with metadata (e.g., RELATED-ISSUE).

Diff / summary:
\`\`\`
${diff}
\`\`\`

Return the result in this format (only the text; no extra commentary):
<type>(<scope>): <title>

<body lines>

<footer if any>
`;
    const aiText = await askAI(prompt, "You are an assistant that writes concise conventional commit messages.", 220);
    spinner.succeed("✅ Commit message generated.");
    console.log(chalk.bold("\n--- Suggested Commit ---"));
    console.log(aiText);
    console.log(chalk.bold("------------------------\n"));

    // Ask to commit or copy
    const { useIt, copyToClipboard } = await inquirer.prompt([
      {
        type: "confirm",
        name: "useIt",
        message: `Stage commit message in this repo (${repoPath}) with git commit?`,
        default: false,
      },
      { type: "confirm", name: "copyToClipboard", message: "Copy commit message to clipboard?", default: false },
    ]);

    if (copyToClipboard) {
      try {
        await execP(`printf "%s" "${aiText.replace(/"/g, '\\"')}" | pbcopy`);
        console.log(chalk.green("✅ Copied to clipboard (pbcopy)."));
      } catch {
        console.log(chalk.yellow("⚠ Could not copy automatically. Please copy manually."));
      }
    }

    if (useIt) {
      try {
        const tmpFile = path.join(repoPath, ".devcli_commit_msg.tmp");
        await fs.writeFile(tmpFile, aiText, "utf8");
        await execP(`git commit --no-verify -F "${tmpFile}"`, { cwd: repoPath });
        await fs.unlink(tmpFile);
        console.log(chalk.green("✅ Committed with AI message."));
      } catch (e) {
        console.log(chalk.red("❌ Git commit failed: " + (e?.message || e)));
      }
    }
  } catch (err) {
    spinner.fail("❌ Failed to generate commit message.");
    console.log(chalk.red(err.message));
  }
}

// ----------------- Feature: README / Doc Generator -----------------
async function featureDocsGenerator() {
  logInfo("\nREADME / Doc Generator");

  const { mode } = await inquirer.prompt([
    {
      type: "list",
      name: "mode",
      message: "Generate docs from:",
      choices: [
        { name: "package.json (project metadata)", value: "pkg" },
        { name: "Single source file (generate README or function docs)", value: "file" },
        { name: "Manual description (I will paste project description)", value: "manual" },
      ],
    },
  ]);

  let content = "";
  let sourcePath = null;

  if (mode === "pkg") {
    // find package.json in cwd
    const pkgPath = "./package.json";
    if (!existsSync(pkgPath)) {
      logWarn("No package.json found in current directory.");
      const { manual } = await inquirer.prompt([{ type: "editor", name: "manual", message: "Paste package.json or project description:" }]);
      content = manual;
    } else {
      content = await fs.readFile(pkgPath, "utf8");
      sourcePath = pkgPath;
    }
  } else if (mode === "file") {
    const { path } = await inquirer.prompt([{ type: "input", name: "path", message: "Path to source file (relative):", default: "index.js" }]);
    if (!existsSync(path)) {
      logWarn("File not found. Please paste file content.");
      const { manual } = await inquirer.prompt([{ type: "editor", name: "manual", message: "Paste file content:" }]);
      content = manual;
    } else {
      content = await fs.readFile(path, "utf8");
      sourcePath = path;
    }
  } else {
    const { manual } = await inquirer.prompt([{ type: "editor", name: "manual", message: "Paste project description and goals:" }]);
    content = manual;
  }

  const { kind } = await inquirer.prompt([
    { type: "list", name: "kind", message: "What do you want generated?", choices: ["Project README", "Function-level docs / JSDoc", "API Usage Examples"] },
  ]);

  const spinner = ora("🧠 Generating docs...").start();

  try {
    let systemPrompt = "You are an expert technical writer who writes clear README and code documentation for developers.";
    let userPrompt = "";

    if (kind === "Project README") {
      userPrompt = `Create a professional README for this project. Include: short description, features, installation steps, usage examples, configuration (env vars), and minimal examples. Keep it concise but complete.

Source content:
\`\`\`
${content}
\`\`\``;
    } else if (kind === "Function-level docs / JSDoc") {
      userPrompt = `Produce JSDoc-style comments for functions in the source file below. Only output the commented source (with JSDoc above functions). If there are multiple functions, document each. Source:
\`\`\`
${content}
\`\`\``;
    } else {
      userPrompt = `Create a short "API usage" section describing how to call the project's public API (example commands or curl). Source:
\`\`\`
${content}
\`\`\``;
    }

    const aiText = await askAI(userPrompt, systemPrompt, 600);
    spinner.succeed("✅ Docs generated.");

    console.log(chalk.bold("\n--- Generated Docs ---\n"));
    console.log(aiText);
    console.log(chalk.bold("\n----------------------\n"));

    const { save } = await inquirer.prompt([{ type: "confirm", name: "save", message: "Save output to a file in current dir?", default: true }]);
    if (save) {
      let filename = "README.md";
      if (kind !== "Project README") {
        const { fname } = await inquirer.prompt([{ type: "input", name: "fname", message: "Filename to save as:", default: kind === "Function-level docs / JSDoc" ? "DOCS.md" : "API.md" }]);
        filename = fname;
      }
      await fs.writeFile(filename, aiText, "utf8");
      logOk(`Saved to ${filename}`);
    }
  } catch (err) {
    spinner.fail("❌ Failed to generate docs.");
    logErr(err.message);
  }
}

// ----------------- Feature: Regex Helper -----------------
function tryTestRegex(pattern, flags, testText) {
  try {
    const re = new RegExp(pattern, flags);
    const matches = testText.match(re);
    return { ok: true, matches };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function featureRegexHelper() {
  logInfo("\nRegex Helper");

  const { spec } = await inquirer.prompt([{ type: "input", name: "spec", message: "Describe what you need (e.g., 'match email addresses' or 'capture date YYYY-MM-DD'):" }]);
  const { examples } = await inquirer.prompt([{ type: "editor", name: "examples", message: "Provide example strings (one per line) to test with:" }]);

  const spinner = ora("🧠 Creating regex...").start();
  try {
    const prompt = `You are an expert at regular expressions.
Generate a concise regular expression (with any flags) to match the user's spec. Provide:
- The regex pattern only (no surrounding slashes),
- Suggested flags (e.g., i, g, m) or "none",
- A short explanation (1-2 lines),
- Example usage in JavaScript (RegExp constructor).
Do not include extraneous commentary.

User spec:
${spec}

Examples:
${examples}
`;
    const aiResp = await askAI(prompt, "Regex expert", 220);
    spinner.succeed("✅ Regex generated.");
    console.log(chalk.bold("\n--- AI Suggestion ---"));
    console.log(aiResp);
    console.log(chalk.bold("---------------------\n"));

    // attempt to parse simple pattern + flags from AI reply heuristically
    // (Look for "pattern: ..." or first code fence or first /.../ )
    let pattern = null;
    let flags = "";
    // try to find code fence
    const fenceMatch = aiResp.match(/```(?:regex|js)?\s*\/?(.+?)\/([gimsuy]*)\s*```/s);
    if (fenceMatch) {
      pattern = fenceMatch[1].trim();
      flags = fenceMatch[2] || "";
    } else {
      // try first /.../ occurrence
      const slashMatch = aiResp.match(/\/(.+?)\/([gimsuy]*)/);
      if (slashMatch) {
        pattern = slashMatch[1];
        flags = slashMatch[2] || "";
      } else {
        // fallback: first line or "pattern:" line
        const patLine = aiResp.split("\n").find(l => /pattern[:\s]/i.test(l)) || aiResp.split("\n")[0];
        pattern = (patLine.split(":").pop() || patLine).trim();
      }
    }

    // Ask user for test
    const { testNow } = await inquirer.prompt([{ type: "confirm", name: "testNow", message: "Run tests with your example strings now?", default: true }]);
    if (testNow) {
      const testText = examples;
      const testResult = tryTestRegex(pattern, flags, testText);
      if (!testResult.ok) {
        logErr("Regex invalid: " + testResult.error);
      } else {
        console.log(chalk.bold("Matches:"));
        console.log(testResult.matches);
      }
    }
  } catch (err) {
    spinner.fail("❌ Failed to create regex.");
    logErr(err.message);
  }
}

// ----------------- Feature: API Tester (AI-assisted) -----------------
async function featureApiTester() {
  logInfo("\nAPI Tester (AI-assisted)");

  const { method, url } = await inquirer.prompt([
    { type: "list", name: "method", message: "HTTP method:", choices: ["GET", "POST", "PUT", "PATCH", "DELETE"] },
    { type: "input", name: "url", message: "Full URL (including protocol):" },
  ]);

  const { addHeaders } = await inquirer.prompt([
    { type: "confirm", name: "addHeaders", message: "Add custom headers?", default: false }
  ]);

  let headers = {};
  if (addHeaders) {
    const { raw } = await inquirer.prompt([
      { type: "input", name: "raw", message: "Paste headers as JSON (e.g., {\"Authorization\":\"Bearer ...\"}):" }
    ]);
    try {
      headers = JSON.parse(raw);
    } catch {
      logWarn("Invalid JSON for headers — ignored.");
      headers = {};
    }
  }

  let data = undefined;
  if (["POST", "PUT", "PATCH"].includes(method)) {
    const { sendBody } = await inquirer.prompt([
      { type: "confirm", name: "sendBody", message: "Do you want to send a request body?", default: false }
    ]);

    if (sendBody) {
      const { body } = await inquirer.prompt([
        { type: "input", name: "body", message: "Enter request body (JSON or raw):" }
      ]);

      try {
        data = JSON.parse(body); // parse JSON if possible
      } catch {
        data = body; // fallback to raw string
      }
    }
  }

  const spinner = ora("🌐 Calling API...").start();
  try {
    const res = await axios.request({ method, url, headers, data, timeout: 20000 });
    spinner.succeed(`✅ ${res.status} ${res.statusText}`);

    // Pretty print response (truncate big bodies)
    const maxPrint = 3000;
    let bodyText;
    try {
      bodyText = typeof res.data === "string" ? res.data : JSON.stringify(res.data, null, 2);
    } catch {
      bodyText = String(res.data);
    }
    if (bodyText.length > maxPrint) {
      console.log(chalk.gray(bodyText.slice(0, maxPrint) + "\n... (truncated) ..."));
    } else {
      console.log(bodyText);
    }

    // Ask AI to summarize the response
    const aiSpinner = ora("🧠 Summarizing response with AI...").start();
    try {
      const summaryPrompt = `You are an experienced developer. Given this HTTP response body and status: 
Status: ${res.status} ${res.statusText}
Headers: ${JSON.stringify(res.headers)}
Body:
\`\`\`
${bodyText.slice(0, 4000)}
\`\`\`
Provide:
1) A 2-line summary of what the response indicates,
2) if its an error summarize it otherwise ignore`;

      const aiSummary = await askAI(summaryPrompt, "Backend debugging assistant", 360);
      aiSpinner.succeed("✅ AI summary ready.");
      console.log(chalk.bold("\n--- AI Summary & Suggestions ---\n"));
      console.log(aiSummary);
      console.log(chalk.bold("\n---------------------------------\n"));
    } catch (aiErr) {
      aiSpinner.fail("❌ AI summary failed.");
      logErr(aiErr.message);
    }
  } catch (err) {
    spinner.fail("❌ API call failed.");
    logErr(err.message || err);
  }
}

// ----------------- Main menu -----------------
async function mainMenu() {
  banner();
  let exit = false;
  while (!exit) {
    const { cmd } = await inquirer.prompt([
      {
        type: "list",
        name: "cmd",
        message: "Choose a tool",
        choices: [
          { name: "Commit message (AI)", value: "commit" },
          { name: "Generate README / Docs", value: "docs" },
          { name: "Regex helper", value: "regex" },
          { name: "API tester (AI-assisted)", value: "api" },
          { name: "Exit", value: "exit" },
        ],
      },
    ]);

    switch (cmd) {
      case "commit":
        await featureCommitMessage();
        break;
      case "docs":
        await featureDocsGenerator();
        break;
      case "regex":
        await featureRegexHelper();
        break;
      case "api":
        await featureApiTester();
        break;
      case "exit":
        exit = true;
        logOk("\n👋 Goodbye.");
        break;
    }
  }
}

// Run
mainMenu().catch((e) => {
  logErr("Fatal error: " + (e?.message || e));
  process.exit(1);
});