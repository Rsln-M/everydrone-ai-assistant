// Step 1: Add imports for types we will use.
// FC (Functional Component) is a helper type for React components.
// We also import THREE to reference types from the three.js library.
import React, { useState, useRef, useEffect, FC, ComponentProps } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Box as DreiBox, Cylinder, Sphere } from '@react-three/drei';
import * as THREE from 'three'; // Import THREE for its types
import './App.css';
import { runAgent } from './useDroneAgent';
// Note: parseFString is not used, so it can be removed.

// --- Reusable Materials ---
const materials = {
  body: <meshStandardMaterial color="#2c3e50" roughness={0.5} metalness={0.9} />,
  wing: <meshStandardMaterial color="#f39c12" roughness={0.4} metalness={0.6} />,
  propeller: <meshStandardMaterial color="#1e272e" roughness={0.1} metalness={0.2} />,
};

// --- Helper Icon Components (Typed) ---
// Step 2: Type the props for our simple SVG components.
// FC<ComponentProps<'svg'>> means this is a Functional Component
// that accepts any standard SVG properties (like className, etc.).
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

// --- 3D Components (Typed) ---

// Step 3: Define the specific props for the Propeller component.
type PropellerProps = {
  position: [number, number, number];
  rotation?: [number, number, number]; // '?' makes the prop optional
  scale?: number;
};

// And apply the type to the component.
const Propeller: FC<PropellerProps> = ({ position, rotation = [0, 0, 0], scale = 1 }) => {
  // Step 4: Add a type to the useRef hook.
  // It will hold a reference to a THREE.Group object.
  const ref = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    // The '!' tells TypeScript "I am sure ref.current is not null here".
    // A safer way is 'if (ref.current) ...'
    if (ref.current) {
      ref.current.rotation.y += delta * 15;
    }
  });
  return (
    <group position={position} ref={ref} scale={scale} rotation={rotation}>
      <DreiBox args={[0.5, 0.02, 0.1]}>{materials.propeller}</DreiBox>
      <DreiBox args={[0.1, 0.02, 0.5]}>{materials.propeller}</DreiBox>
    </group>
  );
};

// Step 5: Define and apply types for the drone components.
// ComponentProps<'group'> allows us to pass standard group props like 'rotation'.
type RotaryWingDroneProps = ComponentProps<'group'> & {
  propellerScale?: number;
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

type FixedWingDroneProps = ComponentProps<'group'> & {
  wingSpan?: number;
  propellerScale?: number;
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

// --- Chat UI Component (Typed) ---

// Step 6: Define types for our chat logic. This is where TS is most helpful.
type ChatMessage = {
  role: 'user' | 'system'; // The role can ONLY be 'user' or 'system'
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
};

// Apply the ChatState type to the component's props.
const ChatWidget: FC<{ chatState: ChatState }> = ({ chatState }) => {
  const {
    isChatOpen, setIsChatOpen, chatHistory,
    userInput, setUserInput, isProcessing, handleCommand
  } = chatState;
  const chatEndRef = useRef<HTMLDivElement>(null); // This ref will be on a <div>

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


// --- Main App Component (Typed) ---
const App: FC = () => {
  // Step 7: Add explicit types to all our state variables.
  const [droneType, setDroneType] = useState<'Fixed-wing' | 'Rotary-wing'>('Fixed-wing');
  const [propellerScale, setPropellerScale] = useState<number>(1);
  const [wingSpan, setWingSpan] = useState<number>(2.5);

  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [userInput, setUserInput] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    { role: 'system', content: 'Hello! How can I configure the drone?' }
  ]);

  const addMessage = (role: ChatMessage['role'], content: string) => {
    setChatHistory(prev => [...prev, { role, content }]);
  };

  // Step 8: Define the type for the functionMap's arguments.
  // This ensures that when we call a function, we know what 'args' will contain.
  const functionMap: Record<string, (args: any) => void> = {
    setDroneType: (args: { type: 'Fixed-wing' | 'Rotary-wing' }) => {
      if (["Fixed-wing", "Rotary-wing"].includes(args.type)) {
        setDroneType(args.type);
        addMessage('system', `Drone type set to ${args.type}.`);
      } else {
        addMessage('system', `Sorry, I don't recognize the type "${args.type}".`);
      }
    },
    setPropellerSize: (args: { scale: string | number }) => {
      const scale = parseFloat(String(args.scale)) || 1;
      setPropellerScale(scale);
      addMessage('system', `Propeller size set to ${scale}x.`);
    },
    setWingSpan: (args: { scale: string | number }) => {
      const scale = parseFloat(String(args.scale)) || 2.5;
      setWingSpan(scale);
      addMessage('system', `Wingspan set to ${scale} meters.`);
    },
    giveInfo: (args: { answer: string }) => {
      addMessage('system', args.answer);
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

  const chatState: ChatState = {
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

export default App;
