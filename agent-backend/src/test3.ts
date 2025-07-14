import { XMLParser } from "fast-xml-parser";
import fetch from "node-fetch";
import { ChatOpenAI } from "@langchain/openai";
import { OpenAIEmbeddings } from "@langchain/openai";
import { PGVectorStore, DistanceStrategy } from "@langchain/community/vectorstores/pgvector";
import { PoolConfig } from "pg";
import "cheerio";
import { CheerioWebBaseLoader } from "@langchain/community/document_loaders/web/cheerio";
import { Document } from "@langchain/core/documents";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { pull } from "langchain/hub";
import { Annotation, StateGraph, MessagesAnnotation, MemorySaver } from "@langchain/langgraph";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import * as dotenv from "dotenv";
import * as allTools from "./tools"; // Use .js extension for Node ESM
import { tool, DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import { AIMessage, HumanMessage, ToolMessage, SystemMessage ,MessageContent, BaseMessage, isAIMessage} from "@langchain/core/messages";

dotenv.config();

const agentCheckpointer = new MemorySaver();

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
  model: "gpt-4.1-nano",
  temperature: 0
});

const embeddings = new OpenAIEmbeddings({
  model: "text-embedding-3-large"
});

const config = {
  postgresConnectionOptions: {
    type: "postgres",
    host: "127.0.0.1",
    port: 5432,
    user: "postgres",
    password: "1234",
    database: "testdb",
  } as PoolConfig,
  tableName: "testlangchainjs",
  columns: {
    idColumnName: "id",
    vectorColumnName: "vector",
    contentColumnName: "content",
    metadataColumnName: "metadata",
  },
  // supported distance strategies: cosine (default), innerProduct, or euclidean
  distanceStrategy: "cosine" as DistanceStrategy,
};

const vectorStore = await PGVectorStore.initialize(embeddings, config);

// const urls = [
//   'https://docs.everydrone.io/docs/advanced-simulation/cfd-components-propeller',
//   'https://docs.everydrone.io/docs/advanced-simulation/cfd-components-wing',
//   'https://docs.everydrone.io/docs/advanced-simulation/cfd-integration-aircraft',
//   'https://docs.everydrone.io/docs/advanced-simulation/cfd-integration-custom',
//   'https://docs.everydrone.io/docs/advanced-simulation/fea-components-propeller',
//   'https://docs.everydrone.io/docs/advanced-simulation/fea-components-wing',
//   'https://docs.everydrone.io/docs/advanced-simulation/fea-integration-aircraft',
//   'https://docs.everydrone.io/docs/advanced-simulation/fea-integration-custom',
//   'https://docs.everydrone.io/docs/advanced-simulation/overview',
//   'https://docs.everydrone.io/docs/basic-drone-design/overview',
//   'https://docs.everydrone.io/docs/category/5-tutorials',
//   'https://docs.everydrone.io/docs/drone-calculator/overview',
//   'https://docs.everydrone.io/docs/intro',
//   'https://docs.everydrone.io/docs/sign-up/sign-up-guide',
//   'https://docs.everydrone.io/docs/tutorials/overview',
// ];

// const allDocs: Document<Record<string, any>>[]  = [];

// for (const url of urls) {
//   try {
//     const cheerioLoader = new CheerioWebBaseLoader(url);
//     const docs = await cheerioLoader.load();
//     allDocs.push(...docs); // spread to flatten
//   } catch (e) {
//     console.error(`Failed to load ${url}:`, e);
//   }
// }

// const splitter = new RecursiveCharacterTextSplitter({
//   chunkSize: 1000, chunkOverlap: 200
// });
// const allSplits = await splitter.splitDocuments(allDocs);


// // Index chunks
// await vectorStore.addDocuments(allSplits)

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
  const llmWithTools = llm.bindTools([retrieve]);
  const response = await llmWithTools.invoke(state.messages.slice(0, -1));
  // MessagesState appends messages to state instead of overwriting
  return { messages: [response] };
}

async function callModel(state: typeof MessagesAnnotation.State) {
  if (state.messages[state.messages.length - 1] instanceof ToolMessage) {
    const response = await llm.invoke(state.messages);
    // We return a list, because this will get added to the existing list
    return { messages: [response] };
  }
  const prompt = [
    new SystemMessage("If and only if the query matches one of the tools EXACTLY, use a tool. Otherwise, return an empty message."),
    ...state.messages,
  ];
  const llmWithTools = llm.bindTools(formattedTools);
  const response = await llmWithTools.invoke(prompt);
  response.content = "";
  // We return a list, because this will get added to the existing list
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
  );
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
  return "__start__";
}

function isCommand({ messages }: typeof MessagesAnnotation.State) {
  const lastMessage = messages[messages.length - 1] as AIMessage;

  // If the tool call is retieve, go to "generate"
  if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
    return "tools";
  }
  if (lastMessage.content === "") {
    return "queryOrRespond"
  }
  // Otherwise, we go to the end
  return "__end__";
}

const graphBuilder = new StateGraph(MessagesAnnotation)
  .addNode("agent", callModel)
  .addNode("queryOrRespond", queryOrRespond)
  .addNode("tools", tools)
  .addNode("generate", generate)
  .addEdge("__start__", "agent")
  .addConditionalEdges("queryOrRespond", toolsCondition, {
    __end__: "__end__",
    tools: "tools",
  })
//   .addEdge("tools", "generate")
  .addConditionalEdges("tools", isRetrieval)
  .addConditionalEdges("agent", isCommand)
  .addEdge("generate", "__end__");

const graph = graphBuilder.compile({checkpointer: agentCheckpointer});

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
const threadConfig = {
  configurable: { thread_id: "abc1234" },
  streamMode: "values" as const,
};

// console.log(formattedTools.concat([retrieve]))

let inputs3 = {
  messages: [{ role: "user", content: "Which criteria is overall drone performance based on" },
    // { role: "user", content: "Which criteria is overall drone performance based on" },
  ],
};

for await (const step of await graph.stream(inputs3, threadConfig)) {
  const lastMessage = step.messages[step.messages.length - 1];
  prettyPrint(lastMessage);
  console.log("-----\n");
}

// const agentFinalState = await graph.invoke(
//   { messages: [new HumanMessage("Which criteria is overall drone performance based on")] },
//   { configurable: { thread_id: "42" } },
// );

// console.log(
//   agentFinalState.messages[agentFinalState.messages.length - 1].content,
// );