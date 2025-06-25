// src/App.jsx

import React, { useState, useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Box as DreiBox, Cylinder, Sphere } from '@react-three/drei';
import './App.css';
import { runAgent } from './useDroneAgent';

// --- Reusable Materials ---
const materials = {
  body: <meshStandardMaterial color="#2c3e50" roughness={0.5} metalness={0.9} />,
  wing: <meshStandardMaterial color="#f39c12" roughness={0.4} metalness={0.6} />,
  propeller: <meshStandardMaterial color="#1e272e" roughness={0.1} metalness={0.2} />,
};

// --- Helper Icon Components ---
const ChatIcon = (props) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const CloseIcon = (props) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.3 5.71a.996.996 0 0 0-1.41 0L12 10.59 7.11 5.7A.996.996 0 1 0 5.7 7.11L10.59 12 5.7 16.89a.996.996 0 1 0 1.41 1.41L12 13.41l4.89 4.89a.996.996 0 1 0 1.41-1.41L13.41 12l4.89-4.89c.38-.38.38-1.02 0-1.4z" />
  </svg>
);

// --- 3D Components ---
function Propeller({ position, rotation = [0, 0, 0], scale = 1 }) {
  const ref = useRef();
  useFrame((_, delta) => { if (ref.current) ref.current.rotation.y += delta * 15; });
  return (
    <group position={position} ref={ref} scale={scale} rotation={rotation}>
      <DreiBox args={[0.5, 0.02, 0.1]}>{materials.propeller}</DreiBox>
      <DreiBox args={[0.1, 0.02, 0.5]}>{materials.propeller}</DreiBox>
    </group>
  );
}

function RotaryWingDrone({ propellerScale = 1, ...props }) {
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
}

function FixedWingDrone({ wingSpan = 2.5, propellerScale = 1, ...props }) {
  return (
    <group {...props}>
      <Cylinder args={[0.2, 0.1, 2, 32]} rotation={[Math.PI / 2, 0, 0]}>{materials.body}</Cylinder>
      <DreiBox args={[wingSpan, 0.1, 0.5]}>{materials.wing}</DreiBox>
      <DreiBox args={[1, 0.08, 0.3]} position={[0, 0, 1.1]}>{materials.wing}</DreiBox>
      <DreiBox args={[0.3, 0.5, 0.08]} position={[0, 0.25, 1.1]}>{materials.wing}</DreiBox>
      <Propeller position={[0, 0, -1.02]} rotation={[Math.PI / 2, 0, 0]} scale={propellerScale} />
    </group>
  );
}

// --- Chat UI Component ---
function ChatWidget({ chatState }) {
  const {
    isChatOpen, setIsChatOpen, chatHistory,
    userInput, setUserInput, isProcessing, handleCommand
  } = chatState;
  const chatEndRef = useRef(null);

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
        <button className="chat-close-btn" onClick={() => setIsChatOpen(false)}>
          <CloseIcon className="chat-close-icon" />
        </button>
      </div>
      <div className="chat-log">
        {chatHistory.map((msg, index) => (
          <div key={index} className={`chat-message ${msg.role}`}>
            <p>{msg.content}</p>
          </div>
        ))}
        {isProcessing && <div className="chat-message system"><p><i>Thinking...</i></p></div>}
        <div ref={chatEndRef} />
      </div>
      <div className="chat-input-area">
        <input
          type="text" value={userInput} onChange={(e) => setUserInput(e.target.value)}
          placeholder="Describe your drone..." onKeyDown={(e) => e.key === 'Enter' && handleCommand()}
          disabled={isProcessing}
        />
        <button onClick={handleCommand} disabled={isProcessing}>Send</button>
      </div>
    </div>
  );
}


// --- Main App Component ---
export default function App() {
  // 3D Scene State
  const [droneType, setDroneType] = useState('Fixed-wing');
  const [propellerScale, setPropellerScale] = useState(1);
  const [wingSpan, setWingSpan] = useState(2.5);

  // Chat State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [userInput, setUserInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [chatHistory, setChatHistory] = useState([
    { role: 'system', content: 'Hello! How can I configure the drone?' }
  ]);

  const addMessage = (role, content) => {
    setChatHistory(prev => [...prev, { role, content }]);
  };

  const functionMap = {
    setDroneType: (args) => {
      if (["Fixed-wing", "Rotary-wing"].includes(args.type)) {
        setDroneType(args.type);
        addMessage('system', `Drone type set to ${args.type}.`);
      } else {
        addMessage('system', `Sorry, I don't recognize the type "${args.type}".`);
      }
    },
    setPropellerSize: (args) => {
      const scale = parseFloat(args.scale) || 1;
      setPropellerScale(scale);
      addMessage('system', `Propeller size set to ${scale}x.`);
    },
    setWingSpan: (args) => {
      const scale = parseFloat(args.scale) || 2.5;
      setWingSpan(scale);
      addMessage('system', `Wingspan set to ${scale} meters.`);
    }
  };

  const handleCommand = async () => {
    if (!userInput.trim() || isProcessing) return;
    addMessage('user', userInput);
    setIsProcessing(true);
    try {
      const result = await runAgent(userInput);
      if (result && functionMap[result.function]) {
        functionMap[result.function](result.args);
      } else {
        addMessage('system', "Sorry, I couldn't understand that command.");
      }
    } catch (error) {
      addMessage('system', "There was an error processing your request.");
      console.error("Agent error:", error);
    }
    setIsProcessing(false);
    setUserInput('');
  };

  const chatState = {
    isChatOpen, setIsChatOpen, chatHistory,
    userInput, setUserInput, isProcessing, handleCommand
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
}
