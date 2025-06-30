import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import * as tools from "./tools";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";

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

// --- NEW: Create a Discriminated Union Type ---
// This mapped type iterates over each tool in tools.ts and creates
// a specific object type for it, e.g.,
// { name: 'setDroneType', args: { type: "Fixed-wing" | "Rotary-wing" } }
type ToolResponseMap = {
  [K in keyof typeof tools]: {
    name: K;
    args: z.infer<typeof tools[K]>;
  }
};

// The final response type is a union of all possible tool response objects.
// e.g. ToolResponseMap['setDroneType'] | ToolResponseMap['setPropellerSize'] | ...
export type ParsedAgentResponse = ToolResponseMap[keyof ToolResponseMap];

/**
 * Runs the AI agent with the user's input.
 * @param userInput The string input from the user.
 * @returns An object that matches one of our tool schemas, or null.
 */
export async function runAgent(userInput: string): Promise<ParsedAgentResponse | null> {
    const systemPrompt = `You are an expert 3D drone configurator assistant. Your primary goal is to help users modify a drone model by calling the available functions.
    
    RULES:
    1.  You MUST ONLY use a function if the user's request is a clear, direct, and unambiguous match for the function's description.
    2.  Do NOT force a function call if the user's intent is unclear or conversational.
    3.  When in doubt, or if no other tool is a direct match, your default behavior MUST be to use the 'giveInfo' function to provide a helpful answer or ask for clarification.
    4.  Be concise in your responses.`;
    try {
        console.log("Invoking AI model with tools...");
        const response = await modelWithTools.invoke([
            new SystemMessage(systemPrompt),
            new HumanMessage(userInput),
        ]);
        console.log("AI model returned:", response);
        
        // Check if the AI decided to call a tool
        if (response.tool_calls && response.tool_calls.length > 0) {
            const toolCall = response.tool_calls[0];
            const functionName = toolCall.name;
            const args = toolCall.args;
            
            console.log("Tool called:", functionName, "with args:", args);
            
            if (functionName in tools) {
                const key = functionName as keyof typeof tools;
                const schema = tools[key];
                // --- MODIFIED: Return an object with both name and parsed args ---
                return { name: key, args: schema.parse(args) } as ParsedAgentResponse;
            }

            console.error("Unknown function called:", functionName);
            return null;
        } else {
            // If no tool was called, return the response using the 'giveInfo' structure
            const content = response.content as string || "I'm not sure how to help with that.";
            return {
                name: 'giveInfo',
                args: { answer: content }
            };
        }
    } catch (error) {
        console.error("AI agent invocation failed:", error);
        return null;
    }
}