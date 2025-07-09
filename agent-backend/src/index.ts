import express from 'express';
import cors from 'cors';
import { runAgent, deleteThread, getChatHistory } from './agent'; // Make sure this path is correct
import {HumanMessage, AIMessage, BaseMessage} from "@langchain/core/messages"

// Initialize the Express app
const app = express();
const port = process.env.PORT || 3001; // Use a port like 3001 for the backend

// Middleware
app.use(cors()); // Enable Cross-Origin Resource Sharing
app.use(express.json()); // Enable parsing of JSON request bodies

// --- API Endpoint ---
// This endpoint will receive user input and a conversation ID
app.post('/api/chat', async (req, res): Promise<any> => {
  try {
    const { userInput, conversationId } = req.body;
    // Validate the incoming request body
    if (!userInput || typeof userInput !== 'string') {
      return res.status(400).json({ error: 'userInput is required and must be a string.' });
    }
    if (!conversationId || typeof conversationId !== 'string') {
      return res.status(400).json({ error: 'conversationId is required and must be a string.' });
    }

    // Call your agent logic
    const agentResponse = await runAgent(userInput, conversationId);

    // Handle the case where the agent fails
    if (agentResponse === null) {
      return res.status(500).json({ error: 'The AI agent failed to process the request.' });
    }
    
    // Send the structured response back to the client
    res.json({ response: agentResponse });

  } catch (error) {
    console.error("Error in /chat endpoint:", error);
    res.status(500).json({ error: 'An internal server error occurred.' });
  }
});

// --- ⭐️ NEW: GET ENDPOINT TO FETCH HISTORY ⭐️ ---
app.get('/api/chat/:threadId', async (req, res) => {
    try {
        const { threadId } = req.params;
        if (!threadId) {
            return res.status(400).json({ error: 'Thread ID is required.' });
        }

        console.log(`Fetching history for thread: ${threadId}`);
        const history = await getChatHistory(threadId);

        if (history && history.length > 0) {
            // Convert LangChain messages to the simple format the frontend expects
            const formattedHistory = history
              .filter(msg =>
                msg instanceof HumanMessage || (msg instanceof AIMessage && (!msg.tool_calls || msg.tool_calls?.length === 0)) // only keep relevant types
              )
              .filter(msg =>
                typeof msg.content === "string" && msg.content.trim() !== "" // skip empty content
              )
              .map(msg => ({
                role: msg instanceof HumanMessage ? "user" : "system",
                content: msg.content
              }));
            res.status(200).json(formattedHistory);
        } else {
            // If no history exists for this thread, return an empty array
            res.status(200).json([]);
        }
    } catch (error) {
        console.error(`Error fetching history for thread:`, error);
        res.status(500).json({ error: 'Failed to fetch chat history.' });
    }
});

app.delete('/api/chat/:threadId', async (req, res) => {
  try {
    const { threadId } = req.params; // Get the ID from the URL parameter

    if (!threadId) {
            return res.status(400).json({ error: 'Thread ID is required.' });
        }
    
    console.log(`Received request to delete thread: ${threadId}`);

    // You call your delete function here
    await deleteThread(threadId);
        
    // Send a success response
    res.status(200).json({ message: `Thread ${threadId} deleted successfully.` });

  } catch (error) {
    console.error("Error deleting thread:", error);
    res.status(500).json({ error: 'Failed to delete chat history.' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`🚀 Backend server is running at http://localhost:${port}`);
});