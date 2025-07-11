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
import { Annotation, StateGraph, MemorySaver } from "@langchain/langgraph";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import * as dotenv from "dotenv";

dotenv.config();

const agentCheckpointer = new MemorySaver();

const llm = new ChatOpenAI({
  model: "gpt-4.1-nano",
  temperature: 0
});


const embeddings = new OpenAIEmbeddings({
  model: "text-embedding-3-large"
});

// Sample config
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

const urls = [
  'https://docs.everydrone.io/docs/advanced-simulation/cfd-components-propeller',
  'https://docs.everydrone.io/docs/advanced-simulation/cfd-components-wing',
  'https://docs.everydrone.io/docs/advanced-simulation/cfd-integration-aircraft',
  'https://docs.everydrone.io/docs/advanced-simulation/cfd-integration-custom',
  'https://docs.everydrone.io/docs/advanced-simulation/fea-components-propeller',
  'https://docs.everydrone.io/docs/advanced-simulation/fea-components-wing',
  'https://docs.everydrone.io/docs/advanced-simulation/fea-integration-aircraft',
  'https://docs.everydrone.io/docs/advanced-simulation/fea-integration-custom',
  'https://docs.everydrone.io/docs/advanced-simulation/overview',
  'https://docs.everydrone.io/docs/basic-drone-design/overview',
  'https://docs.everydrone.io/docs/category/5-tutorials',
  'https://docs.everydrone.io/docs/drone-calculator/overview',
  'https://docs.everydrone.io/docs/intro',
  'https://docs.everydrone.io/docs/sign-up/sign-up-guide',
  'https://docs.everydrone.io/docs/tutorials/overview',
];

// Load and chunk contents of blog
const allDocs: Document<Record<string, any>>[]  = [];

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

// Define prompt for question-answering
const promptTemplate = await pull<ChatPromptTemplate>("rlm/rag-prompt");

// Define state for application
const InputStateAnnotation = Annotation.Root({
  question: Annotation<string>,
});

const StateAnnotation = Annotation.Root({
  question: Annotation<string>,
  context: Annotation<Document[]>,
  answer: Annotation<string>,
});

// Define application steps
const retrieve = async (state: typeof InputStateAnnotation.State) => {
  const retrievedDocs = await vectorStore.similaritySearch(state.question)
  return { context: retrievedDocs };
};


const generate = async (state: typeof StateAnnotation.State) => {
  const docsContent = state.context.map(doc => doc.pageContent).join("\n");
  const messages = await promptTemplate.invoke({ question: state.question, context: docsContent });
  const response = await llm.invoke(messages);
  return { answer: response.content };
};


// Compile application and test
const graph = new StateGraph(StateAnnotation)
  .addNode("retrieve", retrieve)
  .addNode("generate", generate)
  .addEdge("__start__", "retrieve")
  .addEdge("retrieve", "generate")
  .addEdge("generate", "__end__")
  .compile();

graph.checkpointer = agentCheckpointer;

let inputs = { question: "What is Flight time related to?" };
let inputs2 = { question: "Which criteria is overall drone performance based on?"};

const agentFinalState = await graph.invoke(
  inputs2,
  { configurable: { thread_id: "42" } },
);

console.log(
  agentFinalState.answer,
);

const result = await graph.invoke(inputs, { configurable: { thread_id: "42" } },);
console.log(result.answer);