import React, { useState, useRef, useEffect, FC, ComponentProps } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Box as DreiBox, Cylinder, Sphere } from '@react-three/drei';
import * as THREE from 'three';
import './App.css';
import {MessageContent} from '@langchain/core/messages';
import * as allTools from "./tools"; // Use .js extension for Node ESM
import { z } from "zod";

// --- NEW: Define the response type directly in the frontend ---
// This should match the type returned by your backend API

type ToolResponseMap = {
  [K in keyof typeof allTools]: {
    name: K;
    args: z.infer<typeof allTools[K]>;
    message: MessageContent;
  }
};
export type ParsedAgentResponse = ToolResponseMap[keyof typeof allTools];

// --- Type Definitions (No Changes) ---
type PropellerProps = {
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
};

type RotaryWingDroneProps = ComponentProps<'group'> & {
  propellerScale?: number;
};

type FixedWingDroneProps = ComponentProps<'group'> & {
  wingSpan?: number;
  propellerScale?: number;
};

type ChatMessage = {
  role: 'user' | 'system';
  content: string;
};

type ChatState = {
  isChatOpen: boolean;
  setIsChatOpen: React.Dispatch<React.SetStateAction<boolean>>;
  chatHistory: ChatMessage[];
  userInput: string;
  setUserInput: React.Dispatch<React.SetStateAction<string>>;
  isProcessing: boolean;
  handleCommand: () => Promise<void>;
  handleDeleteHistory: () => Promise<void>;
};


// --- Reusable Materials & Icons (No Changes) ---
const materials = {
  body: <meshStandardMaterial color="#2c3e50" roughness={0.5} metalness={0.9} />,
  wing: <meshStandardMaterial color="#f39c12" roughness={0.4} metalness={0.6} />,
  propeller: <meshStandardMaterial color="#1e272e" roughness={0.1} metalness={0.2} />,
};

const ChatIcon: FC<ComponentProps<'svg'>> = (props) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const CloseIcon: FC<ComponentProps<'svg'>> = (props) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.3 5.71a.996.996 0 0 0-1.41 0L12 10.59 7.11 5.7A.996.996 0 1 0 5.7 7.11L10.59 12 5.7 16.89a.996.996 0 1 0 1.41 1.41L12 13.41l4.89 4.89a.996.996 0 1 0 1.41-1.41L13.41 12l4.89-4.89c.38-.38.38-1.02 0-1.4z" />
  </svg>
);

const TrashIcon: FC<ComponentProps<'svg'>> = (props) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
    </svg>
);

// --- 3D Components (No Changes) ---
const Propeller: FC<PropellerProps> = ({ position, rotation = [0, 0, 0], scale = 1 }) => {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, delta) => { if (ref.current) ref.current.rotation.y += delta * 15; });
  return (
    <group position={position} ref={ref} scale={scale} rotation={rotation}>
      <DreiBox args={[0.5, 0.02, 0.1]}>{materials.propeller}</DreiBox>
      <DreiBox args={[0.1, 0.02, 0.5]}>{materials.propeller}</DreiBox>
    </group>
  );
};

const RotaryWingDrone: FC<RotaryWingDroneProps> = ({ propellerScale = 1, ...props }) => {
  return (
    <group {...props}>
      <Sphere args={[0.3, 32, 32]}>{materials.body}</Sphere>
      <DreiBox args={[0.1, 0.05, 2]} rotation={[0, Math.PI / 4, 0]}>{materials.wing}</DreiBox>
      <DreiBox args={[0.1, 0.05, 2]} rotation={[0, -Math.PI / 4, 0]}>{materials.wing}</DreiBox>
      <Propeller position={[0.7, 0.035, 0.7]} scale={propellerScale} />
      <Propeller position={[-0.7, 0.035, 0.7]} scale={propellerScale} />
      <Propeller position={[0.7, 0.035, -0.7]} scale={propellerScale} />
      <Propeller position={[-0.7, 0.035, -0.7]} scale={propellerScale} />
    </group>
  );
};

const FixedWingDrone: FC<FixedWingDroneProps> = ({ wingSpan = 2.5, propellerScale = 1, ...props }) => {
  return (
    <group {...props}>
      <Cylinder args={[0.2, 0.1, 2, 32]} rotation={[Math.PI / 2, 0, 0]}>{materials.body}</Cylinder>
      <DreiBox args={[wingSpan, 0.1, 0.5]}>{materials.wing}</DreiBox>
      <DreiBox args={[1, 0.08, 0.3]} position={[0, 0, 1.1]}>{materials.wing}</DreiBox>
      <DreiBox args={[0.3, 0.5, 0.08]} position={[0, 0.25, 1.1]}>{materials.wing}</DreiBox>
      <Propeller position={[0, 0, -1.02]} rotation={[Math.PI / 2, 0, 0]} scale={propellerScale} />
    </group>
  );
};


// --- Chat UI Component (No Changes) ---
const ChatWidget: FC<{ chatState: ChatState }> = ({ chatState }) => {
  const { isChatOpen, setIsChatOpen, chatHistory, userInput, setUserInput, isProcessing, handleCommand, handleDeleteHistory} = chatState;
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  if (!isChatOpen) {
    return (
      <button className="chat-fab" onClick={() => setIsChatOpen(true)}>
        <ChatIcon className="chat-fab-icon" />
      </button>
    );
  }

  return (
    <div className="chat-widget-container">
      <div className="chat-header">
        <h2>AI Assistant</h2>
        <div>
          <button className="chat-close-btn" onClick={handleDeleteHistory} disabled={isProcessing}>
            <TrashIcon className="chat-close-icon" />
          </button>
          <button className="chat-close-btn" onClick={() => setIsChatOpen(false)}>
            <CloseIcon className="chat-close-icon" />
          </button>
        </div>
      </div>
      <div className="chat-log">
        {chatHistory.map((msg, index) => (
          <div key={index} className={`chat-message ${msg.role}`}><p>{msg.content}</p></div>
        ))}
        {isProcessing && <div className="chat-message system"><p><i>Thinking...</i></p></div>}
        <div ref={chatEndRef} />
      </div>
      <div className="chat-input-area">
        <input type="text" value={userInput} onChange={(e) => setUserInput(e.target.value)}
          placeholder="Describe your drone..." onKeyDown={(e) => e.key === 'Enter' && handleCommand()}
          disabled={isProcessing} />
        <button onClick={handleCommand} disabled={isProcessing}>Send</button>
      </div>
    </div>
  );
};

// --- Main App Component ---
const App: FC = () => {
  // 3D Scene State (No Changes)
  const [droneType, setDroneType] = useState<'Fixed-wing' | 'Rotary-wing'>('Fixed-wing');
  const [propellerScale, setPropellerScale] = useState<number>(1);
  const [wingSpan, setWingSpan] = useState<number>(2.5);
  const [conversationId, setConversationId] = useState(() => `thread_${Date.now()}`);

  // Chat State (No Changes)
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [userInput, setUserInput] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    { role: 'system', content: 'Hello! How can I configure the drone?' }
  ]);

  const addMessage = (role: ChatMessage['role'], content: string) => {
    setChatHistory(prev => [...prev, { role, content }]);
  };

  // --- ⭐️ UPDATED: Main command handler to call the backend ⭐️ ---
  const handleCommand = async () => {
    if (!userInput.trim() || isProcessing) return;
    
    const printMessageContent = (message: MessageContent) => {
      if (typeof message === 'string') addMessage('system', message);
        else {
            addMessage('system', "Sorry, the message content is complex");
        }
    }

    const userMessage = userInput; // Capture user input
    addMessage('user', userMessage);
    setIsProcessing(true);
    setUserInput(''); // Clear input immediately

    try {
      // Step 1: Call your backend API endpoint instead of the local agent
      const response = await fetch('http://localhost:3001/api/chat', { // Replace with your actual API endpoint
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userInput: userMessage,
          conversationId: conversationId, // Send the conversation history
        }),
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      // Step 2: Get the JSON response from the backend
      const data = await response.json();
      const result: ParsedAgentResponse | MessageContent | null = data.response;

      if (!result) {
        addMessage('system', "Sorry, I couldn't process that command.");
        setIsProcessing(false);
        return;
      }
      
      const isToolCall = typeof result === 'object' && 'name' in result;
      // Step 3: The existing switch statement works perfectly with the backend response
      if (isToolCall) {
          const { name, args, message } = result;
          switch (name) {
            case 'setDroneType':
              setDroneType(args.type);
              printMessageContent(message);
              break;

            case 'setPropellerSize':
              setPropellerScale(args.propellerScale);
              printMessageContent(message);
              break;

            case 'setWingSpan':
              setWingSpan(args.wingSpan);
              printMessageContent(message);
              break;

            default:
              addMessage('system', "Sorry, I understood the command but couldn't execute it.");
              break;
          }
      }
      else {
        printMessageContent(result);
      }
    
      } catch (error) {
      addMessage('system', "There was an error processing your request.");
      console.error("API error:", error);
    }

    setIsProcessing(false);
  };

  // --- ⭐️ NEW: Add the delete history handler function ⭐️ ---
  const handleDeleteHistory = async () => {
    if (isProcessing) return;

    // Optional: Ask for confirmation
    const isConfirmed = window.confirm("Are you sure you want to start a new chat? The current history will be deleted.");
    if (!isConfirmed) {
        return;
    }

    setIsProcessing(true);
    try {
        const response = await fetch(`http://localhost:3001/api/chat/${conversationId}`, {
            method: 'DELETE',
        });

        if (!response.ok) {
            throw new Error("Failed to delete history on the server.");
        }

        // If successful, reset the frontend state
        console.log("History deleted, starting new thread.");
        setChatHistory([{ role: 'system', content: 'New chat started. How can I help?' }]);
        setConversationId(`thread_${Date.now()}`); // Generate a new ID for the new conversation

    } catch (error) {
        console.error("Error deleting chat history:", error);
        addMessage('system', 'Sorry, I could not delete the chat history.');
    }
    setIsProcessing(false);
  };

  const chatState: ChatState = {
    isChatOpen, setIsChatOpen, chatHistory,
    userInput, setUserInput, isProcessing, handleCommand,
    handleDeleteHistory,
  };

  return (
    <div className="app-container">
      <Canvas camera={{ position: [3, 3, 3] }}>
        <color attach="background" args={['#ffffff']} />
        <ambientLight intensity={1.5} />
        <directionalLight position={[5, 10, 7.5]} intensity={2.5} />
        {droneType === 'Fixed-wing' && <FixedWingDrone rotation={[0, 0.5, 0]} wingSpan={wingSpan} propellerScale={propellerScale} />}
        {droneType === 'Rotary-wing' && <RotaryWingDrone rotation={[0, 0.5, 0]} propellerScale={propellerScale} />}
        <OrbitControls />
        <gridHelper args={[10, 10, '#cccccc', '#e0e0e0']} />
      </Canvas>
      <ChatWidget chatState={chatState} />
    </div>
  );
};

export default App;