import { z } from "zod";

// Define a schema for the setDroneType function
export const setDroneType = z.object({
  type: z.enum(["Fixed-wing", "Rotary-wing"]).describe("The type of drone to display"),
}).describe("Set the type of drone to be displayed in the 3D view.");

// UPDATED: Renamed 'scale' to be more specific
export const setPropellerSize = z.object({
  propellerScale: z.number().describe("The new scale of the propellers. 1 is default, 2 is double size."),
}).describe("Adjust the size of the propellers on the current drone.");

// UPDATED: Renamed 'scale' to be more specific
export const setWingSpan = z.object({
  wingSpan: z.number().describe("The new wingspan for the fixed-wing drone, in meters."),
}).describe("Adjust the wingspan of the fixed-wing drone.");

// Define a schema for when the AI should just talk to the user
export const giveInfo = z.object({
    answer: z.string().describe("The information to provide to the user. This can be a recommendation, an answer to a question, or a confirmation."),
}).describe("Use this function to provide information or answer a general question when no specific drone configuration is requested.");
