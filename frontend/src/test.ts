// npm install @langchain-anthropic
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { MemorySaver, StateGraph, START, MessagesAnnotation } from "@langchain/langgraph";
import { HumanMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import * as dotenv from "dotenv";
import * as tools from "./tools";
import { tool } from "@langchain/core/tools";

import { z } from "zod";

dotenv.config();
const agentCheckpointer = new MemorySaver();

async function callModel(state: typeof MessagesAnnotation.State) {
  const response = await model.invoke(state.messages);
  // We return a list, because this will get added to the existing list
  return { messages: [response] };
}

const formattedTools = Object.entries(tools).map(([name, schema]) => {
    return {
        name: name,
        description: schema.description,
        schema: schema,
    };
});
// console.log(formattedTools);
const search = tool(async ({ query }) => {
  if (query.toLowerCase().includes("sf") || query.toLowerCase().includes("san francisco")) {
    return "It's 60 degrees and foggy."
  }
  return "It's 90 degrees and sunny."
}, {
  name: "search",
  description: "Call to surf the web.",
  schema: z.object({
    query: z.string().describe("The query to use in your search."),
  }),
});

const giveInfo = tool(async ({ answer }) => {
  console.log(answer)
}, {
  name: "giveInfo",
  description: "This is the default fallback tool. Use this to ask for clarification if a user's request is ambiguous (e.g., missing a parameter), or to answer any general question when no other tool is a direct match.",
  schema: z.object({
    answer: z.string().describe("The information to provide to the user. This can be a recommendation, a question for clarification, or a confirmation."),
})
});

const setPropellerSize = tool(async ({ }) => {
  // console.log("Propeller size set to: " + propellerScale)
}, {
  name: "setPropellerSize",
  description: tools.setPropellerSize.description,
  schema: tools.setPropellerSize,
}
);

const model =  new ChatOpenAI({
  temperature: 0,
  modelName: "gpt-4.1-mini",
});


const ResponseFormatter = z.object({
  function_name: z.string().describe("the tool name"),
  args: z.object({}),
})

const agent = createReactAgent({
  llm: model,
  tools: [setPropellerSize],
  checkpointSaver: agentCheckpointer,
  responseFormat: ResponseFormatter,
  // interruptBefore: ["tools"],
});

// const result = await agent.invoke(
//   {
//     messages: [{
//       role: "user",
//       content: "yes"
//     }]
//   }
// );

// console.log(result)

const agentFinalState = await agent.invoke(
  { messages: [new HumanMessage("Set propeller size")] },
  { configurable: { thread_id: "42" } },
);

console.log(
  agentFinalState.messages[agentFinalState.messages.length - 1].content,
);

console.log(
  agentFinalState,
);

const agentNextState = await agent.invoke(
  { messages: [new HumanMessage("2")] },
  { configurable: { thread_id: "42" } },
);

console.log(
  agentNextState.messages[agentNextState.messages.length - 1].content,
);

console.log(
  agentNextState,
);

const agentNextState1 = await agent.invoke(
  { messages: [new HumanMessage("What is the size of the propeller?")] },
  { configurable: { thread_id: "42" } },
);

console.log(
  agentNextState1.messages[agentNextState1.messages.length - 1].content,
);
console.log(
  agentNextState1
);
// const agentFinalState = await agent.invoke(
//   { messages: [new HumanMessage("set the propeller size")] },
//   { configurable: { thread_id: "42" } },
// );

// console.log(
//   agentFinalState,
// );

// const agentNextState = await agent.invoke(
//   { messages: [new HumanMessage("2")] },
//   { configurable: { thread_id: "42" } },
// );

// console.log(
//   agentNextState,
// );

// const agentFinalState = await agent.invoke(
//   { messages: [new HumanMessage("My name is Ruslan")] },
//   { configurable: { thread_id: "42" } },
// );

// console.log(
//   agentFinalState.messages[agentFinalState.messages.length - 1].content,
// );

// const agentNextState = await agent.invoke(
//   { messages: [new HumanMessage("In which country is San Francisco?")] },
//   { configurable: { thread_id: "42" } },
// );

// console.log(
//   agentNextState.messages[agentNextState.messages.length - 1].content,
// );

// const agentFinalState1 = await agent.invoke(
//   { messages: [new HumanMessage("Who was the 16th president of the US?")] },
//   { configurable: { thread_id: "42" } },
// );

// console.log(
//   agentFinalState1.messages[agentFinalState1.messages.length - 1].content,
// );

// const agentNextState1 = await agent.invoke(
//   { messages: [new HumanMessage("What is my name?")] },
//   { configurable: { thread_id: "42" } },
// );

// console.log(
//   agentNextState1.messages[agentNextState1.messages.length - 1].content,
// );