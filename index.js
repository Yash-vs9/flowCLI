#!/usr/bin/env node

import chalk from "chalk";
import figlet from "figlet";
import inquirer from "inquirer";
import OpenAI from "openai";
import fs from "fs/promises";
import dotenv from "dotenv";
import ora from "ora";

dotenv.config();
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Configuration 
const CONFIG = {
  maxTokens: 300,
  model: "gpt-4o-mini",
  saveFile: ".life-sim-data.json",
  temperature: 0.8
};

// Helpers 
const log = (msg) => console.log(chalk.cyan(msg));
const success = (msg) => console.log(chalk.green(`✅ ${msg}`));
const warn = (msg) => console.log(chalk.yellow(`⚠️  ${msg}`));
const error = (msg) => console.log(chalk.red(`❌ ${msg}`));
const info = (msg) => console.log(chalk.blue(`ℹ️  ${msg}`));

function banner() {
  console.log(chalk.magenta(
    figlet.textSync("Life Sim Pro", { horizontalLayout: "full" })
  ));
  console.log(chalk.gray("🤖 Enhanced AI Life Simulator v2.0\n"));
}

// Enhanced OpenAI call with spinner and token limit
async function askAI(prompt, systemPrompt = "", maxTokens = CONFIG.maxTokens) {
  try {
    const messages = [
      ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
      { role: "user", content: prompt }
    ];

    const res = await client.chat.completions.create({
      model: CONFIG.model,
      messages,
      max_tokens: maxTokens,
      temperature: CONFIG.temperature,
    });

    return res.choices[0].message.content.trim();
  } catch (e) {
    error(`API Error: ${e.message}`);
    return "⚠️ Simulation temporarily unavailable. Please check your API key.";
  }
}

// Enhanced ASCII visualization
function createVisualOutput(title, content, type = "box") {
  console.log(`\n${chalk.magenta('═'.repeat(60))}`);
  console.log(chalk.magenta(`🎯 ${title.toUpperCase()}`));
  console.log(chalk.magenta('═'.repeat(60)));
  
  if (type === "timeline") {
    content.split('\n').forEach((line, i) => {
      if (line.trim()) {
        console.log(chalk.gray(`${i + 1}. `) + chalk.white(line.trim()));
      }
    });
  } else {
    console.log(chalk.white(content));
  }
  
  console.log(chalk.magenta('═'.repeat(60)));
}

// Save user data
async function saveData(data) {
  try {
    await fs.writeFile(CONFIG.saveFile, JSON.stringify(data, null, 2));
  } catch (e) {
    warn("Could not save data");
  }
}

async function loadData() {
  try {
    const data = await fs.readFile(CONFIG.saveFile, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    return { history: [], preferences: {} };
  }
}

// Enhanced Features 

// 1. Advanced Life Choice Simulator
async function simulateAdvancedChoice() {
  const { choice, timeframe, focus } = await inquirer.prompt([
    { type: "input", name: "choice", message: "🎯 Life choice to simulate:" },
    { 
      type: "list", 
      name: "timeframe", 
      message: "📅 Timeframe:",
      choices: ["1 year", "5 years", "10 years", "20 years"]
    },
    {
      type: "checkbox",
      name: "focus",
      message: "🎨 Focus areas (select multiple):",
      choices: ["Career", "Relationships", "Health", "Finances", "Happiness", "Personal Growth"]
    }
  ]);

  const systemPrompt = `You are a life simulation expert and mentor. Provide realistic, balanced outcomes considering both positive and negative possibilities in a consice manner under 100 tokens`;
  const prompt = `Simulate choosing "${choice}" over ${timeframe}, focusing on: ${focus.join(", ")}. 
                 Provide specific milestones, challenges, and outcomes in 2-3 bullet points only.`;
  const spinner = ora("Thinking...").start();

  const result = await askAI(prompt, systemPrompt, 400);
  spinner.succeed("Take a look :D")
  createVisualOutput(`Life Simulation: ${choice}`, result, "timeline");
  
  // Save to history
  const data = await loadData();
  data.history.push({ type: "simulation", choice, timeframe, result, date: new Date() });
  await saveData(data);
}

//  AI Career Path Generator
async function generateCareerPath() {
  const { interests, skills, goals } = await inquirer.prompt([
    { type: "input", name: "interests", message: "🎨 Your interests/passions:" },
    { type: "input", name: "skills", message: "💪 Current skills:" },
    { type: "input", name: "goals", message: "🎯 Career goals:" }
  ]);

  const systemPrompt = `Generate a practical 5-step career roadmap with specific actions, timelines, and skill development.`;
  const prompt = `Create a career path for someone with interests in "${interests}", 
                 skills in "${skills}", and goals: "${goals}". Include specific steps, resources, and timelines.`;

  const result = await askAI(prompt, systemPrompt, 450);
  createVisualOutput("Your AI-Generated Career Roadmap", result);
}

//  Relationship Compatibility Analyzer
async function analyzeCompatibility() {
  const { person1, person2, context } = await inquirer.prompt([
    { type: "input", name: "person1", message: "👤 Person 1 traits/interests:" },
    { type: "input", name: "person2", message: "👥 Person 2 traits/interests:" },
    { 
      type: "list", 
      name: "context", 
      message: "💝 Relationship type:",
      choices: ["Romantic", "Friendship", "Business Partnership", "Roommates"]
    }
  ]);

  const systemPrompt = `Analyze compatibility objectively, highlighting both strengths and potential challenges.`;
  const prompt = `Analyze ${context.toLowerCase()} compatibility between "${person1}" and "${person2}". 
                 Provide compatibility score, strengths, challenges, and tips.`;

  const result = await askAI(prompt, systemPrompt);
  createVisualOutput(`${context} Compatibility Analysis`, result);
}

//  Financial Future Simulator
async function simulateFinances() {
  const { age, income, expenses, goals } = await inquirer.prompt([
    { type: "number", name: "age", message: "🎂 Current age:" },
    { type: "number", name: "income", message: "💰 Monthly income ($):" },
    { type: "number", name: "expenses", message: "💸 Monthly expenses ($):" },
    { type: "input", name: "goals", message: "🏆 Financial goals:" }
  ]);

  const systemPrompt = `Provide realistic financial projections and actionable advice.`;
  const prompt = `Financial simulation for ${age}-year-old, $${income} income, $${expenses} expenses, goals: "${goals}". 
                 Show 5, 10, 20-year projections with savings, investments, and goal achievement timeline.`;

  const result = await askAI(prompt, systemPrompt, 400);
  createVisualOutput("Financial Future Projection", result);
}

//  Dream Interpreter & Life Insights
async function interpretDream() {
  const { dream, emotions, context } = await inquirer.prompt([
    { type: "input", name: "dream", message: "💭 Describe your dream:" },
    { type: "input", name: "emotions", message: "😊 Emotions in the dream:" },
    { type: "input", name: "context", message: "📋 Current life situation:" }
  ]);

  const systemPrompt = `Interpret dreams psychologically, connecting symbols to potential life meanings and insights.`;
  const prompt = `Interpret this dream: "${dream}" with emotions "${emotions}" for someone in this situation: "${context}". 
                 Provide symbolic meanings and life insights.`;

  const result = await askAI(prompt, systemPrompt);
  createVisualOutput("Dream Analysis & Life Insights", result);
}

// Random Life Event Generator
async function generateRandomEvent() {
  const { category, impact } = await inquirer.prompt([
    {
      type: "list",
      name: "category",
      message: "🎲 Event category:",
      choices: ["Career", "Relationship", "Adventure", "Challenge", "Opportunity", "Random"]
    },
    {
      type: "list",
      name: "impact",
      message: "⚡ Impact level:",
      choices: ["Minor", "Moderate", "Major", "Life-changing"]
    }
  ]);

  const prompt = `Generate a realistic ${impact.toLowerCase()} ${category.toLowerCase()} life event. 
                 Describe the event, immediate effects, and potential long-term consequences.`;

  const result = await askAI(prompt, "", 250);
  createVisualOutput(`Random ${impact} ${category} Event`, result);
}

// 7. Personal Growth Tracker
async function trackGrowth() {
  const data = await loadData();
  
  if (data.history.length === 0) {
    info("No simulation history found. Try other features first!");
    return;
  }

  const { reflection } = await inquirer.prompt([
    { type: "input", name: "reflection", message: "💡 Recent personal insights or changes:" }
  ]);

  const prompt = `Based on this reflection: "${reflection}" and previous life simulations, 
                 provide personalized growth insights, patterns, and next steps for development.`;

  const result = await askAI(prompt, "", 350);
  createVisualOutput("Personal Growth Analysis", result);
  
  info(`📊 Total simulations completed: ${data.history.length}`);
}

//  Enhanced Menu System 
const MENU_OPTIONS = [
  { name: "🎯 Advanced Life Choice Simulator", value: "advanced_sim" },
  { name: "🚀 AI Career Path Generator", value: "career" },
  { name: "💕 Relationship Compatibility", value: "compatibility" },
  { name: "💰 Financial Future Simulator", value: "finance" },
  { name: "💭 Dream Interpreter", value: "dream" },
  { name: "🎲 Random Life Event Generator", value: "random" },
  { name: "📈 Personal Growth Tracker", value: "growth" },
  { name: "📊 View Simulation History", value: "history" },
  { name: "⚙️  Settings", value: "settings" },
  { name: "🚪 Exit", value: "exit" }
];

async function showHistory() {
  const data = await loadData();
  if (data.history.length === 0) {
    info("No simulation history found.");
    return;
  }
  
  console.log(chalk.magenta("\n📊 Simulation History:"));
  data.history.slice(-5).forEach((entry, i) => {
    console.log(chalk.gray(`${i + 1}. ${entry.type} - ${entry.choice || entry.date}`));
  });
}

async function showSettings() {
  const { newLimit } = await inquirer.prompt([
    { 
      type: "number", 
      name: "newLimit", 
      message: `Current token limit: ${CONFIG.maxTokens}. New limit:`,
      default: CONFIG.maxTokens
    }
  ]);
  
  CONFIG.maxTokens = newLimit;
  success(`Token limit updated to ${newLimit}`);
}

// Main execution
async function mainLoop() {
  banner();
  
  let exit = false;
  while (!exit) {
    const { action } = await inquirer.prompt([{
      type: "list",
      name: "action",
      message: "🤖 Choose your simulation:",
      choices: MENU_OPTIONS,
    }]);

    try {
      switch (action) {
        case "advanced_sim": await simulateAdvancedChoice(); break;
        case "career": await generateCareerPath(); break;
        case "compatibility": await analyzeCompatibility(); break;
        case "finance": await simulateFinances(); break;
        case "dream": await interpretDream(); break;
        case "random": await generateRandomEvent(); break;
        case "growth": await trackGrowth(); break;
        case "history": await showHistory(); break;
        case "settings": await showSettings(); break;
        case "exit":
          exit = true;
          console.log(chalk.green("\n🌟 Thanks for exploring life's possibilities! 👋"));
          break;
      }
      
      if (!exit) {
        await inquirer.prompt([{ type: "input", name: "continue", message: "\nPress Enter to continue..." }]);
      }
    } catch (e) {
      error(`Something went wrong: ${e.message}`);
    }
  }
}

mainLoop();