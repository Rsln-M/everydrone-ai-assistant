import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { FUNCTION_LIST } from "./functions.ts"; // This will be converted to .ts later

// IMPORTANT: In a frontend project, expose environment variables with a VITE_ prefix
// Your .env file should look like: VITE_OPENAI_API_KEY=sk-...
const chat = new ChatOpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  temperature: 0,
  modelName: "gpt-4-turbo", // Using a more recent model can improve reliability
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

// Step 1: Define the shape of the AI's response with an interface.
// This tells TypeScript exactly what the returned JSON object should look like.
interface AgentResponse {
  function: string;
  args: Record<string, unknown>; // args is an object with string keys and any type of value
}

// Step 2: Add types to the function's parameters and its return value.
// It accepts a 'string' and returns a 'Promise' that will resolve to
// either an 'AgentResponse' object or 'null' if something goes wrong.
export async function runAgent(userInput: string): Promise<AgentResponse | null> {
  const formattedPrompt = await prompt.format({
    functions: FUNCTION_LIST.join("\n"),
    input: userInput,
  });

  const response = await chat.invoke(formattedPrompt);
  
  try {
    // We expect the 'content' to be a string that we can parse.
    const content = typeof response.content === 'string' ? response.content : '';
    // We cast the parsed result 'as AgentResponse' to tell TypeScript
    // to trust that it matches our interface.
    return JSON.parse(content) as AgentResponse;
  } catch (error) {
    console.error("Failed to parse AI response:", error);
    console.error("Raw response:", response.content);
    return null; // Return null in case of an error
  }
}
