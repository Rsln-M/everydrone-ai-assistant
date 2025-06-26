import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import * as tools from "./tools"; // Import all our Zod schemas as a single module object

// Initialize the Chat Model
const chat = new ChatOpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  temperature: 0,
  modelName: "gpt-4-turbo",
});
// Step 1: Combine all individual tool schemas into a single union schema.
// This tells the model to pick ONE of the available tools.
const toolSchemas = z.union([
    tools.setDroneType,
    tools.setPropellerSize,
    tools.setWingSpan,
    tools.giveInfo
]);

// Step 3: Create a new "chain" by binding the structured output schema to the model.
// This forces the model's output to match the shape of one of our tools.
const modelWithTools = chat.withStructuredOutput(toolSchemas);


// Step 4: Define the new AgentResponse type directly from our Zod schema.
// z.infer automatically creates a TypeScript type from a Zod schema.
// This is much safer than our old manual interface.
export type AgentResponse = z.infer<typeof toolSchemas>;

/**
 * Runs the AI agent with the user's input.
 * @param userInput The string input from the user.
 * @returns An object that is guaranteed to match one of our tool schemas, or null.
 */
export async function runAgent(userInput: string) {
    try {
        console.log("Invoking AI model with tools...");
        const response = await modelWithTools.invoke(userInput);
        console.log("AI model returned:", response);
        return response;
    } catch (error) {
        console.error("AI agent invocation failed:", error);
        return null;
    }
}
