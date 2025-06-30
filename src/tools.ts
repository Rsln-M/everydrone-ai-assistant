import { z } from "zod";

// Define a schema for the setDroneType function
export const setDroneType = z.object({
  type: z.enum(["Fixed-wing", "Rotary-wing"]).describe("The type of drone to display"),
}).describe(
  "Changes the drone model shown in the 3D view. Use this only when the user explicitly asks to switch between 'Fixed-wing' and 'Rotary-wing' models. Do not use this to answer general questions about drone types."
);

// UPDATED: Renamed 'scale' to be more specific
export const setPropellerSize = z.object({
  propellerScale: z.number().describe("The new scale of the propellers. 1 is default, 2 is double size."),
}).describe(
  "Sets a new scale for the propellers on the currently displayed drone. Use this only for direct requests to make propellers bigger, smaller, or a specific size. This function is ONLY for changing the size of propellers, not anything else about propellers"
);

// UPDATED: Renamed 'scale' to be more specific
export const setWingSpan = z.object({
  wingSpan: z.number().describe("The new wingspan for the fixed-wing drone, in meters."),
}).describe(
  "Sets the exact wingspan for the fixed-wing drone model, specified in meters. Use this only when the user gives a specific instruction to change the wing size or span. Do not use this function to answer general questions about wings."
);

// Define a schema for when the AI should just talk to the user
export const giveInfo = z.object({
    answer: z.string().describe("The information to provide to the user. This can be a recommendation, an answer to a question, or a confirmation."),
}).describe(
  "This is the default fallback tool. Use this to answer any general question, provide recommendations, ask for clarification, or respond conversationally when no other tool is a direct and explicit match for the user's request."
);