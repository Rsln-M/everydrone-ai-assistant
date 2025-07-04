import { ChatOpenAI } from "@langchain/openai";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { MemorySaver, StateGraph, MessagesAnnotation, START } from "@langchain/langgraph";
import * as dotenv from "dotenv";
// import { set } from "zod/v4";
import * as tools from "./tools";
import { all } from "three/tsl";


dotenv.config();
// -----------------------------------------------------------------------------
// 1. Define Your Tools
// -----------------------------------------------------------------------------
// For this example, we'll create a simple custom tool.
const setPropellerSize = tool(async ({ }) => {
//   console.log("Propeller size set to: " + propellerScale)
}, {
  name: "setPropellerSize",
  description: tools.setPropellerSize.description,
  schema: tools.setPropellerSize,
}
);

const sayHello = tool(async ({ }) => {
  console.log("Hi there");
}, {
  name: "sayHello",
  description: "Use this function when the user says hi",
  schema: z.object({}),
}
);

// Declared ToolNode
const allTools = [setPropellerSize]; 
const toolNode = new ToolNode(allTools);


// -----------------------------------------------------------------------------
// 2. Create the ReAct Agent
// -----------------------------------------------------------------------------
// We'll use a standard OpenAI model and the prebuilt ReAct agent factory.
const model =  new ChatOpenAI({
  temperature: 0,
  modelName: "gpt-4.1-mini",
}).bindTools(allTools);

// Checkpointer
const agentCheckpointer = new MemorySaver();

// Node that runs the agent to decide the next action
async function callModel(state: typeof MessagesAnnotation.State) {
  const response = await model.invoke(state.messages);

  // We return a list, because this will get added to the existing list
  return { messages: [response] };
}

// Node to inspect the tool call without executing it
// function inspectToolCall({ messages }: typeof MessagesAnnotation.State) {
//   const lastMessage = messages[messages.length - 1] as AIMessage;
//   if (lastMessage.tool_calls?.length) {
//     // Extract and print the details 🕵️‍♀️
//   const toolCall = lastMessage.tool_calls[0];
//   const { name, args } = toolCall;

//   console.log("--- TOOL CALL INTERCEPTED ---");
//   console.log(`Tool Name: ${name}`);
//   console.log("Tool Arguments:", args);
//   console.log("-----------------------------");

//   // We don't return any new messages or take further action.
//   // The graph will end here.
//   return {};
//   }
//   else {
//     console.log("serious error");
//     return {};
//   }
  
// }

// -----------------------------------------------------------------------------
// 4. Define the Graph's Conditional Logic
// -----------------------------------------------------------------------------
// This function decides where to go after the agent node.
function shouldContinue({ messages }: typeof MessagesAnnotation.State) {
  const lastMessage = messages[messages.length - 1] as AIMessage;

  // If the LLM makes a tool call, then we route to the "tools" node
  if (lastMessage.tool_calls?.length) {
    console.log("SUCCESS!");
    return "tools";
  }
  // Otherwise, we stop (reply to the user) using the special "__end__" node
  return "__end__";
}

// -----------------------------------------------------------------------------
// 5. Build and Compile the Graph
// -----------------------------------------------------------------------------
const workflow = new StateGraph(MessagesAnnotation)
    .addNode("agent", callModel)
    .addNode("tools", toolNode)
    // .addNode("inspect", inspectToolCall)
    .addEdge(START, "agent")
    .addEdge("tools", "agent")
    // .addEdge("inspect", "__end__")
    .addConditionalEdges("agent", shouldContinue);

// Compile the graph into a runnable object.
const app = workflow.compile();
app.checkpointer = agentCheckpointer;

// const graph = await app.getGraphAsync (); 
// const image = await graph.drawMermaidPng();
// const url = URL.createObjectURL(image);
// const a = document.createElement("a");
// a.href = url;
// a.download = "image.jpg"; // desired file name
// a.click();
// URL.revokeObjectURL(url); // clean up


// -----------------------------------------------------------------------------
// 6. Run the Graph
// -----------------------------------------------------------------------------
const agentFinalState = await app.invoke(
  { messages: [new HumanMessage("hi")] },
  { configurable: { thread_id: "42" } },
);

console.log(
  agentFinalState.messages[agentFinalState.messages.length - 1].content,
);

// console.log(
//   agentFinalState,
// );

const agentNextState = await app.invoke(
  { messages: [new HumanMessage("Set the drone propeller size to 2")] },
  { configurable: { thread_id: "42" } },
);

console.log(
  agentNextState.messages[agentNextState.messages.length - 1].content,
);

// console.log(
//   agentNextState,
// );

const agentNextState2 = await app.invoke(
  { messages: [new HumanMessage("What is the propeller size")] },
  { configurable: { thread_id: "42" } },
);

console.log(
  agentNextState2.messages[agentNextState.messages.length - 1].content,
);

console.log(
  agentNextState2,
);