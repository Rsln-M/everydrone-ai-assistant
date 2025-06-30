import { z } from "zod";

export const setDroneType = z.object({
  type: z.enum(["Fixed-wing", "Rotary-wing"]).describe("The type of drone to display"),
}).describe(
  "Changes the drone model shown in the 3D view. Use this only when the user explicitly asks to switch between 'Fixed-wing' and 'Rotary-wing' models."
);

export const setPropellerSize = z.object({
  propellerScale: z.number()
    .min(0.5, "Propeller scale cannot be less than 0.5.")
    .max(2.5, "Propeller scale cannot be greater than 3.")
    .describe("The new scale for the propellers. Must be between 0.5 and 3."),
}).describe(
  "Sets a new scale for the propellers on the currently displayed drone. Use this only for direct requests to make propellers bigger, smaller, or a specific size."
);

export const setWingSpan = z.object({
  wingSpan: z.number()
    .min(2, "Wingspan cannot be less than 1 meter.")
    .max(5, "Wingspan cannot be greater than 10 meters.")
    .describe("The new wingspan for the fixed-wing drone, in meters. Must be between 1 and 10."),
}).describe(
  "Sets the exact wingspan for the fixed-wing drone model, specified in meters. Use this only when the user gives a specific instruction to change the wing size or span."
);

export const giveInfo = z.object({
    answer: z.string().describe("The information to provide to the user. This can be a recommendation, a question for clarification, or a confirmation."),
}).describe(
  "This is the default fallback tool. Use this to ask for clarification if a user's request is ambiguous (e.g., missing a parameter), or to answer any general question when no other tool is a direct match."
);