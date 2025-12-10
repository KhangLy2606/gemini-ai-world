
import React, { useState } from 'react';
import { GameView } from './components/GameView';
import { AgentCreator } from './src/components/AgentCreator';
import { AgentData, ConversationStreamEventDetail, PartialMessage } from './types';
import { getCharacterByJob, getCharacterById } from './src/config/CharacterRegistry';
import { sanitizeMessage } from './src/utils/sanitize';

const App: React.FC = () => {
  const [selectedAgent, setSelectedAgent] = useState<AgentData | null>(null);
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [isCreatorOpen, setCreatorOpen] = useState(false);
  
  // Streaming state
  const [partialMessage, setPartialMessage] = useState<PartialMessage | null>(null);
  const [isTyping, setIsTyping] = useState(false);

  // Callback passed to Phaser logic
  const handleAgentSelect = (agent: AgentData) => {
    setSelectedAgent(agent);
    setSidebarOpen(true);
  };

  const handleCreateAgent = (newAgent: Partial<AgentData>) => {
    // In a real app, we would send this to the backend via Socket.io or REST API
    // For now, we'll just log it. The GameView/MainScene needs a way to receive this.
    // Since GameView is a wrapper around Phaser, we might need to expose a method or use a context/event bus.
    // However, for this demo, we can just log it and maybe emit a socket event if the socket was accessible here.
    console.log("Creating new agent:", newAgent);
    
    // Ideally, we emit to the socket here if we had access to it.
    // Since the socket is inside MainScene, we can't easily reach it from here without lifting state up or using a global socket.
    // But we can simulate it by dispatching a custom event that MainScene listens to, or just assume the backend handles it.
    
    const event = new CustomEvent('create-agent', { detail: newAgent });
    window.dispatchEvent(event);
  };

  const handleConversationUpdate = (detail: ConversationStreamEventDetail) => {
      // Only update if relevant to the selected agent
      if (!selectedAgent) return;
      
      // Check if this update belongs to the current conversation
      // We assume conversationId contains agentId or we check if the sender is the selected agent or their partner
      // For simplicity, we'll just update if we have a selected Agent, 
      // but in production consider checking detail.conversationId equality
      
      if (detail.status === 'typing') {
          setIsTyping(true);
      } else if (detail.status === 'streaming' && detail.partialMessage) {
          setIsTyping(false);
          setPartialMessage(detail.partialMessage);
      } else if (detail.status === 'complete') {
          setIsTyping(false);
          setPartialMessage(null);
          // Force re-render to show the completed message which is now in history
          setSelectedAgent(prev => prev ? {...prev} : null);
      } else {
          setIsTyping(false);
          setPartialMessage(null);
      }
  };

  const getAvatarStyle = (agent: AgentData) => {
    // Look up character from registry
    let character;
    
    if (agent.spriteKey) {
      // Use spriteKey if available (custom characters)
      character = getCharacterById(agent.spriteKey);
    } else if (agent.job) {
      // Fall back to job-based lookup
      character = getCharacterByJob(agent.job);
    } else {
      // Default fallback
      character = getCharacterById('TECH_DEV_MALE');
    }
    
    // Calculate sprite position from frame index
    const frameX = (character.frameIndex % 16) * 32;
    const frameY = Math.floor(character.frameIndex / 16) * 32;
    
    // We want to display it at 2.5x scale (32px -> 80px)
    const scale = 2.5;
    const sheetSize = 512;
    
    return {
        backgroundImage: `url(${character.spritePath})`,
        backgroundPosition: `-${frameX * scale}px -${frameY * scale}px`,
        backgroundSize: `${sheetSize * scale}px ${sheetSize * scale}px`,
        width: '100%',
        height: '100%',
        imageRendering: 'pixelated' as const,
        backgroundColor: '#222'
    };
  };

  return (
    <div className="flex h-screen w-screen bg-gray-950 text-white font-sans overflow-hidden">
      
      {/* 1. Game Layer */}
      <div className="flex-1 relative z-0">
        <GameView 
            onAgentSelect={handleAgentSelect} 
            onConversationUpdate={handleConversationUpdate}
        />
        
        {/* HUD Overlay */}
        <div className="absolute top-4 left-4 p-3 bg-gray-900/80 backdrop-blur-md rounded-lg border border-gray-700/50 pointer-events-none shadow-lg">
            <h1 className="font-bold text-lg text-emerald-400 tracking-tight">AI Visual World</h1>
            <div className="flex items-center space-x-2 mt-1">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                <span className="text-xs text-gray-300">Live Simulation</span>
            </div>
            <p className="text-xs text-gray-500 mt-2">WASD / Arrows: Pan Camera</p>
            <p className="text-xs text-gray-500">Mouse Wheel / +/-: Zoom</p>
        </div>

        {/* Create Agent Button */}
        <div className="absolute bottom-6 left-6 pointer-events-auto">
          <button 
            onClick={() => setCreatorOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-3 rounded-lg font-bold shadow-lg shadow-emerald-900/30 flex items-center gap-2 transition-all transform hover:scale-105"
          >
            <span className="text-xl">+</span> Create Agent
          </button>
        </div>
      </div>

      {/* Agent Creator Modal */}
      {isCreatorOpen && (
        <AgentCreator 
          onClose={() => setCreatorOpen(false)} 
          onCreate={handleCreateAgent}
        />
      )}

      {/* 2. UI Layer (Sidebar) */}
      {isSidebarOpen && (
        <aside className="w-96 border-l border-gray-800 bg-gray-900/95 backdrop-blur-sm flex flex-col z-10 shadow-2xl transition-all">
          <div className="p-5 border-b border-gray-800 flex justify-between items-center bg-gray-900">
            <h2 className="font-bold text-lg tracking-wide text-gray-200">
                {selectedAgent ? 'Agent Database' : 'System Log'}
            </h2>
            <button 
                onClick={() => setSidebarOpen(false)}
                className="text-gray-500 hover:text-white transition-colors p-1"
            >
                ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            {!selectedAgent ? (
                <div className="flex flex-col items-center justify-center h-64 text-gray-500 space-y-4">
                    <div className="w-12 h-12 rounded-full border-2 border-dashed border-gray-700 animate-spin-slow"></div>
                    <p>Select an entity to decrypt data.</p>
                </div>
            ) : (
                <>
                    {/* Agent Header */}
                    <div className="flex items-start space-x-5">
                        <div className="relative">
                            <div 
                                className="w-20 h-20 rounded-xl border border-gray-600 bg-gray-800 flex items-center justify-center text-3xl shadow-inner overflow-hidden"
                            >
                                {/* Render the sprite frame here */}
                                <div style={getAvatarStyle(selectedAgent)} />
                            </div>
                            <div className="absolute -bottom-2 -right-2 bg-gray-800 text-xs px-2 py-0.5 rounded border border-gray-600 font-mono">
                                ID:{selectedAgent.characterId ?? 0}
                            </div>
                        </div>
                        
                        <div className="flex-1">
                            <h3 className="text-2xl font-bold text-white">{selectedAgent.name || "Unknown Entity"}</h3>
                            <div className="flex items-center space-x-2 mt-2">
                                <span className={`px-2.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider border
                                    ${selectedAgent.state === 'idle' ? 'bg-gray-800 border-gray-600 text-gray-300' : ''}
                                    ${selectedAgent.state === 'moving' ? 'bg-blue-900/30 border-blue-500 text-blue-400' : ''}
                                    ${selectedAgent.state === 'chatting' ? 'bg-emerald-900/30 border-emerald-500 text-emerald-400' : ''}
                                `}>
                                    {selectedAgent.state}
                                </span>
                                <span className="text-xs text-gray-500 font-mono">
                                    COORD: {selectedAgent.gridX}:{selectedAgent.gridY}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Chat Terminal */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-end">
                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                                {selectedAgent.activeConversation && selectedAgent.activeConversation.length > 0 
                                    ? 'Live Feed' 
                                    : 'Communication Log'}
                            </h4>
                            {selectedAgent.conversationPartnerId && (
                                 <span className="text-[10px] text-emerald-400 bg-emerald-900/20 px-2 py-0.5 rounded border border-emerald-900/50">
                                    Link: {selectedAgent.conversationPartnerId.substring(0, 8)}...
                                 </span>
                            )}
                        </div>
                        
                        <div className="bg-black rounded-lg p-4 text-sm font-mono border border-gray-800 min-h-[150px] max-h-[300px] overflow-y-auto shadow-inner relative flex flex-col gap-3 custom-scrollbar">
                            {selectedAgent.activeConversation && selectedAgent.activeConversation.length > 0 ? (
                                <>
                                    {selectedAgent.activeConversation.map((msg, idx) => {
                                        const isSelf = msg.senderId === selectedAgent.id;
                                        return (
                                            <div key={idx} className={`flex ${isSelf ? 'justify-end' : 'justify-start'}`}>
                                                <div className={`max-w-[85%] rounded-lg p-2 text-xs ${
                                                    isSelf 
                                                        ? 'bg-emerald-900/40 text-emerald-100 border border-emerald-800/50 rounded-br-none' 
                                                        : 'bg-gray-800 text-gray-300 border border-gray-700 rounded-bl-none'
                                                }`}>
                                                    <p className="font-bold text-[10px] mb-0.5 opacity-50 uppercase">
                                                        {isSelf ? 'YOU' : msg.senderName}
                                                    </p>
                                                    {sanitizeMessage(msg.text)}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {/* Scroll Anchor */}
                                    <div ref={(el) => el?.scrollIntoView({ behavior: 'smooth' })} />
                                </>
                            ) : (
                                // Logic for empty history...
                                // We'll handle empty state below if no partial message
                                <></>
                            )}

                            {/* Streaming Partial Message */}
                            {partialMessage && (
                                <div className="flex justify-start">
                                    <div className="max-w-[85%] bg-gray-800 text-gray-400 rounded-lg p-2 text-xs border border-gray-700 rounded-bl-none">
                                        <p className="font-bold text-[10px] mb-0.5 opacity-50 uppercase">
                                            {partialMessage.senderName}
                                        </p>
                                        <p className="text-gray-300">
                                            {sanitizeMessage(partialMessage.accumulatedText)}
                                            <span className="animate-pulse ml-1 text-emerald-400">▊</span>
                                        </p>
                                    </div>
                                    <div ref={(el) => el?.scrollIntoView({ behavior: 'smooth' })} />
                                </div>
                            )}

                             {/* Typing Indicator */}
                            {isTyping && !partialMessage && (
                                <div className="flex justify-start">
                                    <div className="bg-gray-800 text-gray-400 rounded-lg p-2 text-xs italic border border-gray-700 rounded-bl-none">
                                        <span className="animate-pulse">Thinking...</span>
                                    </div>
                                     <div ref={(el) => el?.scrollIntoView({ behavior: 'smooth' })} />
                                </div>
                            )}

                            {/* Empty State (only if no history and no streaming) */}
                            {(!selectedAgent.activeConversation || selectedAgent.activeConversation.length === 0) && !partialMessage && !isTyping && (
                                <div className="relative h-full flex flex-col justify-end min-h-[100px]">
                                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent"></div>
                                    {selectedAgent.lastMessage ? (
                                        <p className="text-emerald-400">
                                            <span className="text-emerald-700 mr-2">{'>'}</span>
                                            {selectedAgent.lastMessage}
                                            <span className="animate-pulse">_</span>
                                        </p>
                                    ) : (
                                        <p className="italic text-gray-700 text-xs">Awaiting signal...</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Stats & Bio */}
                    <div className="space-y-3">
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Entity Profile</h4>
                        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
                            <p className="text-sm text-gray-300 leading-relaxed">
                                {selectedAgent.bio || "No biographical data available in local cache."}
                            </p>
                        </div>
                    </div>
                </>
            )}
          </div>
        </aside>
      )}

      {!isSidebarOpen && (
        <button 
            onClick={() => setSidebarOpen(true)}
            className="absolute top-6 right-6 z-20 bg-gray-900/90 p-3 rounded-full shadow-xl border border-gray-700 text-white hover:bg-emerald-600 hover:border-emerald-500 transition-all"
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
            </svg>
        </button>
      )}
    </div>
  );
};

export default App;
