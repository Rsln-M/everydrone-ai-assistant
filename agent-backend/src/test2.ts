import { ChatOpenAI } from "@langchain/openai";
import { OpenAIEmbeddings } from "@langchain/openai";
import { PGVectorStore, DistanceStrategy } from "@langchain/community/vectorstores/pgvector";
import { pull } from "langchain/hub";
import { Annotation, StateGraph, MessagesAnnotation, MemorySaver } from "@langchain/langgraph";
import * as dotenv from "dotenv";
import * as allTools from "./tools"; // Use .js extension for Node ESM
import { tool, DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import { AIMessage, HumanMessage, ToolMessage, SystemMessage ,MessageContent, BaseMessage, isAIMessage} from "@langchain/core/messages";
import {config} from "./config";

dotenv.config();

const checkpointer = new MemorySaver();
// Format tools for the agent
const formattedTools: DynamicStructuredTool[] = Object.entries(allTools).map(([name, schema]) => 
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

const llm = new ChatOpenAI({
  model: "gpt-4.1-mini",
  temperature: 0
});

const embeddings = new OpenAIEmbeddings({
  model: "text-embedding-3-large"
});

const vectorStore = await PGVectorStore.initialize(embeddings, config);

const retrieveSchema = z.object({ query: z.string() });

const retrieve = tool(
  async ({ query }) => {
    const retrievedDocs = await vectorStore.similaritySearch(query, 2);
    const serialized = retrievedDocs
      .map(
        (doc) => `Source: ${doc.metadata.source}\nContent: ${doc.pageContent}`
      )
      .join("\n");
    return [serialized, retrievedDocs];
  },
  {
    name: "retrieve",
    description: "Retrieve information related to a query. You are to use this if the query is NOT a command. This is for answering user queries using the official documentation. Unless you need to ask the user a clarifying question, use this to answer queries.",
    schema: retrieveSchema,
    responseFormat: "content_and_artifact",
  }
);

// Step 1: Generate an AIMessage that may include a tool-call to be sent.
async function queryOrRespond(state: typeof MessagesAnnotation.State) {
  const llmWithTools = llm.bindTools(formattedTools.concat([retrieve]));
  const response = await llmWithTools.invoke(state.messages.slice(-10));
  if (response.tool_calls && response.tool_calls.length > 0) {
    const retrieveCalls = response.tool_calls.filter((call) => call.name === "retrieve");
    const otherTools = response.tool_calls.filter((call) => call.name !== "retrieve")
        .map((call) => {return {name: call.name, args: call.args}});
    if(retrieveCalls.length > 0) {
        response.tool_calls = retrieveCalls;
    } else {
        console.log(response.tool_calls);
        response.tool_calls = [];
        console.log(response.additional_kwargs);
        response.additional_kwargs = {};
        response.content = JSON.stringify(otherTools);
        // console.log(await llm.invoke([response]));
    }
  }
  // MessagesState appends messages to state instead of overwriting
  return { messages: [response] };
}

// Step 2: Execute the retrieval.
const tools = new ToolNode(formattedTools.concat([retrieve]));

// Step 3: Generate a response using the retrieved content.
async function generate(state: typeof MessagesAnnotation.State) {
  // Get generated ToolMessages
  let recentToolMessages: ToolMessage[] = [];
  for (let i = state["messages"].length - 1; i >= 0; i--) {
    let message = state["messages"][i];
    if (message instanceof ToolMessage) {
      recentToolMessages.push(message);
    } else {
      break;
    }
  }
  let toolMessages = recentToolMessages.reverse();

  // Format into prompt
  const docsContent = toolMessages.map((doc) => doc.content).join("\n");
  const systemMessageContent =
    "You are an assistant for question-answering tasks. " +
    "Use the following pieces of retrieved context to answer " +
    "the question. If you don't know the answer, say that you " +
    "don't know. Use three sentences maximum and keep the " +
    "answer concise." +
    "\n\n" +
    `${docsContent}`;

  const conversationMessages = state.messages.filter(
    (message) =>
      message instanceof HumanMessage ||
      message instanceof SystemMessage ||
      (message instanceof AIMessage && message.tool_calls?.length == 0)
  ).slice(-10);
  const prompt = [
    new SystemMessage(systemMessageContent),
    ...conversationMessages,
  ];

  // Run
  const response = await llm.invoke(prompt);
  return { messages: [response] };
}

function isRetrieval({ messages }: typeof MessagesAnnotation.State) {
  const lastMessage = messages[messages.length - 1] as ToolMessage;

  // If the tool call is retieve, go to "generate"
  if (lastMessage.name && lastMessage.name === "retrieve") {
    return "generate";
  }
  // Otherwise, we go to the beginning
  return "queryOrRespond";
}

const graphBuilder = new StateGraph(MessagesAnnotation)
  .addNode("queryOrRespond", queryOrRespond)
  .addNode("tools", tools)
  .addNode("generate", generate)
  .addEdge("__start__", "queryOrRespond")
  .addConditionalEdges("queryOrRespond", toolsCondition, {
    __end__: "__end__",
    tools: "tools",
  })
  .addConditionalEdges("tools", isRetrieval)
  .addEdge("generate", "__end__");

export const graph = graphBuilder.compile({checkpointer: checkpointer});

const prettyPrint = (message: BaseMessage) => {
  let txt = `[${message.getType()}]: ${message.content}`;
  if ((isAIMessage(message) && message.tool_calls?.length) || 0 > 0) {
    const tool_calls = (message as AIMessage)?.tool_calls
      ?.map((tc) => `- ${tc.name}(${JSON.stringify(tc.args)})`)
      .join("\n");
    txt += ` \nTools: \n${tool_calls}`;
  }
  console.log(txt);
};

// Specify an ID for the thread
// const threadConfig = {
//   configurable: { thread_id: "abc1234" },
//   streamMode: "values" as const,
// };

// console.log(formattedTools.concat([retrieve]))

// let inputs3 = {
//   messages: [{ role: "user", content: "Which criteria is overall drone performance based on" },
//     // { role: "user", content: "Which criteria is overall drone performance based on" },
//   ],
// };

// for await (const step of await graph.stream(inputs3, threadConfig)) {
//   const lastMessage = step.messages[step.messages.length - 1];
//   prettyPrint(lastMessage);
//   console.log("-----\n");
// }

// const agentFinalState = await graph.invoke(
//   { messages: [new HumanMessage("hi")] },
//   { configurable: { thread_id: "42" } },
// );

// console.log(
//   agentFinalState.messages[agentFinalState.messages.length - 1].content,
// );

// const agentFinalState2 = await graph.invoke(
//   { messages: [new HumanMessage("set propeller size to 2 and drone type to rotary")] },
//   { configurable: { thread_id: "42" } },
// );

// console.log(
//   JSON.parse((agentFinalState2.messages[agentFinalState2.messages.length - 1].content) as string)
// );

const agentFinalState = await graph.invoke(
  { messages: [new HumanMessage("Set the drone size to 2. Also, tell me which criteria is overall drone performance based on?")] },
  { configurable: { thread_id: "42" } },
);

console.log(
  agentFinalState.messages[agentFinalState.messages.length - 1].content
);

console.log(agentFinalState);
vectorStore.end();