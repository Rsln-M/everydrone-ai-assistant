import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { AIMessage, HumanMessage, ToolMessage, MessageContent, BaseMessage} from "@langchain/core/messages";
import { PGVectorStore, DistanceStrategy} from "@langchain/community/vectorstores/pgvector";
// import {WebBaseLoader} from "@langchain/community/document_loaders/cheertio";
import { MemorySaver } from "@langchain/langgraph";
import { z } from "zod";
import * as allTools from "./tools"; // Use .js extension for Node ESM
import { tool } from "@langchain/core/tools";
import * as dotenv from "dotenv";
import {PostgresSaver} from "@langchain/langgraph-checkpoint-postgres";
import pg, {PoolConfig} from "pg";

const { Pool } = pg;

// Edit this part to match the database you created
const pool = new Pool({
  connectionString: "postgresql://postgres:1234@localhost:5432/testdb"
});

dotenv.config();

// Initialize the Chat Model
const chat = new ChatOpenAI({
  temperature: 0,
  modelName: "gpt-4.1-nano",
});

const checkpointer = new PostgresSaver(pool);

// NOTE: you need to call .setup() the first time you're using your checkpointer
await checkpointer.setup();

export async function deleteThread(conversationId: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      "DELETE FROM checkpoints WHERE thread_id = $1",
      [conversationId]
    );
    await client.query(
      "DELETE FROM checkpoint_blobs WHERE thread_id = $1",
      [conversationId]
    );
    await client.query(
      "DELETE FROM checkpoint_writes WHERE thread_id = $1",
      [conversationId]
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error deleting thread:", err);
    throw err;
  } finally {
    client.release();
  }
}

export async function getChatHistory(conversationId: string): Promise<BaseMessage[] | null>{
  try {
    const messages = (await checkpointer.get({configurable: {thread_id: conversationId}}))?.channel_values?.messages;
    return Array.isArray(messages) ? messages : [];
  } catch (err) {
    console.error("Error getting chat history:", err);
    return null;
  }
}

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
// const memory = new MemorySaver();

// Define the response type for the frontend
type ToolResponseMap = {
  [K in keyof typeof allTools]: {
    name: K;
    args: z.infer<typeof allTools[K]>;
    message: MessageContent;
  }
};

export type ParsedAgentResponse = ToolResponseMap[keyof typeof allTools];

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