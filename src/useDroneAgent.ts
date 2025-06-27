import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import * as tools from "./tools";

// Initialize the Chat Model
const chat = new ChatOpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  temperature: 0,
  modelName: "gpt-4-turbo",
});

// Bind the tools to the model by providing the name, description, and schema.
// LangChain automatically converts this to the format OpenAI expects.
const modelWithTools = chat.withConfig({
    tools: [
        {
            name: "setDroneType",
            description: tools.setDroneType.description,
            schema: tools.setDroneType,
        },
        {
            name: "setPropellerSize",
            description: tools.setPropellerSize.description,
            schema: tools.setPropellerSize,
        },
        {
            name: "setWingSpan",
            description: tools.setWingSpan.description,
            schema: tools.setWingSpan,
        },
        {
            name: "giveInfo",
            description: tools.giveInfo.description,
            schema: tools.giveInfo,
        },
    ],
    tool_choice: "auto", // Explicitly set tool choice
});

// Define the AgentResponse type that App.tsx expects
export type AgentResponse = 
  | z.infer<typeof tools.setDroneType>
  | z.infer<typeof tools.setPropellerSize>
  | z.infer<typeof tools.setWingSpan>
  | z.infer<typeof tools.giveInfo>;

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
            
            // Validate and return the arguments based on the function called
            switch (functionName) {
                case "setDroneType":
                    return tools.setDroneType.parse(args);
                case "setPropellerSize":
                    return tools.setPropellerSize.parse(args);
                case "setWingSpan":
                    return tools.setWingSpan.parse(args);
                case "giveInfo":
                    return tools.giveInfo.parse(args);
                default:
                    console.error("Unknown function called:", functionName);
                    return null;
            }
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