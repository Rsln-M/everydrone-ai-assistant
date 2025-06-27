import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import * as tools from "./tools";

// Initialize the Chat Model
const chat = new ChatOpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  temperature: 0,
  modelName: "gpt-4.1-mini",
});

// --- AUTOMATED TOOLS SETUP ---
const formattedTools = Object.entries(tools).map(([name, schema]) => {
    return {
        name: name,
        description: schema.description,
        schema: schema,
    };
});

// Bind the tools to the model by providing the name, description, and schema.
// LangChain automatically converts this to the format OpenAI expects.
const modelWithTools = chat.withConfig({
    tools: formattedTools,
    tool_choice: "auto", // Explicitly set tool choice
});

// --- AUTOMATED RESPONSE TYPE ---
// This creates a union type of all possible tool schemas.
// It grabs all the values from the 'tools' object and infers their types.
type ToolSchemas = typeof tools[keyof typeof tools];
export type AgentResponse = z.infer<ToolSchemas>;


/**
 * Runs the AI agent with the user's input.
 * @param userInput The string input from the user.
 * @returns An object that matches one of our tool schemas, or null.
 */
export async function runAgent(userInput: string): Promise<AgentResponse | null> {
    try {
        console.log("Invoking AI model with tools...");
        const response = await modelWithTools.invoke(userInput);
        console.log("AI model returned:", response);
        
        // Check if the AI decided to call a tool
        if (response.tool_calls && response.tool_calls.length > 0) {
            const toolCall = response.tool_calls[0];
            const functionName = toolCall.name;
            const args = toolCall.args;
            
            console.log("Tool called:", functionName, "with args:", args);
            
            if (functionName in tools) {
                // Inside this block, TypeScript is now certain that functionName is a valid key.
                const key = functionName as keyof typeof tools;
                const schema = tools[key];
                return schema.parse(args);
            }

            console.error("Unknown function called:", functionName);
            return null;
        } else {
            // If no tool was called, return a generic info response
            return {
                answer: response.content as string || "I'm not sure how to help with that."
            };
        }
    } catch (error) {
        console.error("AI agent invocation failed:", error);
        return null;
    }
}