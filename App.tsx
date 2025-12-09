
import React, { useState } from 'react';
import { GameView } from './components/GameView';
import { AgentData } from './types';

const App: React.FC = () => {
  const [selectedAgent, setSelectedAgent] = useState<AgentData | null>(null);
  const [isSidebarOpen, setSidebarOpen] = useState(true);

  // Callback passed to Phaser logic
  const handleAgentSelect = (agent: AgentData) => {
    setSelectedAgent(agent);
    setSidebarOpen(true);
  };

  return (
    <div className="flex h-screen w-screen bg-gray-950 text-white font-sans overflow-hidden">
      
      {/* 1. Game Layer */}
      <div className="flex-1 relative z-0">
        <GameView onAgentSelect={handleAgentSelect} />
        
        {/* HUD Overlay */}
        <div className="absolute top-4 left-4 p-3 bg-gray-900/80 backdrop-blur-md rounded-lg border border-gray-700/50 pointer-events-none shadow-lg">
            <h1 className="font-bold text-lg text-emerald-400 tracking-tight">AI Visual World</h1>
            <div className="flex items-center space-x-2 mt-1">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                <span className="text-xs text-gray-300">Live Simulation</span>
            </div>
            <p className="text-xs text-gray-500 mt-2">WASD / Arrows to move camera</p>
        </div>
      </div>

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
                                {/* In a real app, render the sprite frame here via canvas or background-image */}
                                <div style={{
                                    width: '100%',
                                    height: '100%',
                                    backgroundColor: selectedAgent.color ? `#${selectedAgent.color.toString(16)}` : '#333',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                   {selectedAgent.name ? selectedAgent.name[0] : '#'}
                                </div>
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
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Communication Log</h4>
                        <div className="bg-black rounded-lg p-4 text-sm font-mono border border-gray-800 min-h-[100px] shadow-inner relative overflow-hidden">
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
