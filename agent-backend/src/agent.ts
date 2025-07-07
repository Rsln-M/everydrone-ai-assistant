import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { AIMessage, HumanMessage, ToolMessage, MessageContent} from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph";
import { z } from "zod";
import * as allTools from "./tools"; // Use .js extension for Node ESM
import { tool } from "@langchain/core/tools";
import * as dotenv from "dotenv";
import {PostgresSaver} from "@langchain/langgraph-checkpoint-postgres";
import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  connectionString: "postgresql://postgres:1234@localhost:5432/testdb"
});

const checkpointer = new PostgresSaver(pool);

// NOTE: you need to call .setup() the first time you're using your checkpointer

// await checkpointer.setup();

dotenv.config();
// Initialize the Chat Model
const chat = new ChatOpenAI({
  temperature: 0,
  modelName: "gpt-4.1-nano",
});

// Format tools for the agent
const formattedTools = Object.entries(allTools).map(([name, schema]) => 
  {
    return tool(async ({}) => {},
      {
          name: name,
          description: schema.description,
          schema: schema,
      }
    )
  }
);

// Initialize the checkpointer for conversation memory
const memory = new MemorySaver();

// Create the AI Agent with Memory
const agent = createReactAgent({
  llm: chat,
  tools: formattedTools,
  checkpointSaver: checkpointer, // This enables conversation memory
  prompt: `You are an expert 3D drone configurator assistant. Your primary goal is to help users modify a drone model by calling the available functions.
    RULES:
    1.  You MUST ONLY use a function if the user's request is a clear, direct, and unambiguous match for the function's description.
    2.  Do NOT force a function call if the user's intent is unclear or conversational.
    3.  When in doubt, or if no tool is a direct match, your default behavior MUST be to ask for clarification.
    4.  Be concise in your responses.`,
});

// Define the response type for the frontend
type ToolResponseMap = {
  [K in keyof typeof allTools]: {
    name: K;
    args: z.infer<typeof allTools[K]>;
    message: MessageContent;
  }
};
export type ParsedAgentResponse = ToolResponseMap[keyof typeof allTools];


/**
 * Runs the AI agent with user input and a conversation ID.
 * @param userInput The string input from the user.
 * @param conversationId A unique ID for the conversation thread.
 * @returns A structured response for the frontend.
 */
export async function runAgent(userInput: string, conversationId: string): Promise<ParsedAgentResponse | null | MessageContent> {
    try {
        console.log(`Invoking agent for conversation: ${conversationId}`);
        
        // The agent needs a list of messages. For a new conversation, we start with the system prompt.
        // For an existing one, the checkpointer loads the history automatically.
        const response = await agent.invoke(
            { messages: [new HumanMessage(userInput)] },
            { configurable: { thread_id: conversationId } }
        );
        
        const lastMessage = response.messages[response.messages.length - 1].content;
        console.log("Final agent response:", lastMessage);

        if (response.messages[response.messages.length - 2] instanceof ToolMessage) {
          const func_call = response.messages[response.messages.length - 3] as AIMessage;
          if (func_call.tool_calls && func_call.tool_calls.length > 0) {
            const toolCall = func_call.tool_calls[0];
            const functionName = toolCall.name as keyof typeof allTools;
            return { name: functionName, args: toolCall.args, message: lastMessage } as ParsedAgentResponse;
          }
        }
        return lastMessage;
    } catch (error) {
        console.error("AI agent invocation failed:", error);
        return null;
    }
}