import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { FUNCTION_LIST } from "./functions.js";
// IMPORTANT: In a frontend project, expose environment variables with a VITE_ prefix
// Your .env file should look like: VITE_OPENAI_API_KEY=sk-...
const chat = new ChatOpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  temperature: 0,
  modelName: "gpt-4.1-mini",
});

const prompt = new PromptTemplate({
    template:
    `You are an AI assistant that translates user requests into a specific JSON format.
    Only respond with the JSON object. Do not include any other text or explanations.

    Here is the list of available functions:
    {functions}

    User Request: {input}

    Based on the request, provide a JSON object in the following format:
    {{
    "function": "function_name",
    "args": {{ "arg1": "value1", "arg2": "value2" }}
    }}`,
    inputVariables: ["functions", "input"],
    });

// This function will run the agent and parse the output
export async function runAgent(userInput) {
  const formattedPrompt = await prompt.format({
    functions: FUNCTION_LIST.join("\n"),
    input: userInput,
  });

  const response = await chat.invoke(formattedPrompt);
  
  try {
    // The AI's response should be a JSON string, so we parse it
    return JSON.parse(response.content);
  } catch (error) {
    console.error("Failed to parse AI response:", error);
    console.error("Raw response:", response.content);
    return null; // Handle cases where the AI doesn't return valid JSON
  }
}