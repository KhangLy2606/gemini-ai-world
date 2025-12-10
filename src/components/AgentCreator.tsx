
import React, { useState } from 'react';
import { JobRole, JOB_SKINS } from '../config/JobRegistry';
import { CHARACTER_REGISTRY, getCharacterById, CharacterDefinition } from '../config/CharacterRegistry';
import { ImageGenerationService } from '../services/ImageGenerationService';
import { AgentData } from '../../types';

interface AgentCreatorProps {
  onClose: () => void;
  onCreate: (agent: Partial<AgentData>) => void;
}

export const AgentCreator: React.FC<AgentCreatorProps> = ({ onClose, onCreate }) => {
  const [mode, setMode] = useState<'catalog' | 'generate'>('catalog');
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [selectedJob, setSelectedJob] = useState<JobRole | null>(null);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  
  // Generation State
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);

  // Get all available characters from registry
  const availableCharacters = Object.values(CHARACTER_REGISTRY);

  const handleCreate = () => {
    if (!name) return;

    const newAgent: Partial<AgentData> = {
      name,
      bio: bio || 'A newly created digital entity.',
      state: 'idle',
      gridX: Math.floor(Math.random() * 20) + 10, // Random spawn near center
      gridY: Math.floor(Math.random() * 15) + 5,
    };

    if (mode === 'catalog') {
      // Use selected character from registry or fall back to job
      if (selectedCharacterId) {
        const character = getCharacterById(selectedCharacterId);
        newAgent.spriteKey = character.id;
        newAgent.job = character.id; // Use character ID as job for backward compatibility
      } else if (selectedJob) {
        newAgent.job = selectedJob;
      }
    } else if (mode === 'generate' && generatedImage) {
      // For generated agents, assign a custom character key
      // In production, this would integrate with the ingestion tool
      newAgent.job = 'TECH_DEV_MALE' as JobRole; // Fallback until custom texture is loaded
      // TODO: When ingestion pipeline is ready, set newAgent.spriteKey to the generated character ID
    }

    onCreate(newAgent);
    onClose();
  };

  const handleGenerate = async () => {
    if (!prompt) return;
    setIsGenerating(true);
    try {
      const imageUrl = await ImageGenerationService.generateCharacterSprite(prompt);
      setGeneratedImage(imageUrl);
    } catch (error) {
      console.error("Generation failed", error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-950">
          <h2 className="text-xl font-bold text-white tracking-wide">Create New Agent</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-800">
          <button 
            className={`flex-1 py-3 text-sm font-medium transition-colors ${mode === 'catalog' ? 'bg-gray-800 text-emerald-400 border-b-2 border-emerald-500' : 'text-gray-400 hover:bg-gray-800/50'}`}
            onClick={() => setMode('catalog')}
          >
            Select from Catalog
          </button>
          <button 
            className={`flex-1 py-3 text-sm font-medium transition-colors ${mode === 'generate' ? 'bg-gray-800 text-purple-400 border-b-2 border-purple-500' : 'text-gray-400 hover:bg-gray-800/50'}`}
            onClick={() => setMode('generate')}
          >
            Generate with AI
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Common Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase">Agent Name</label>
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Unit-734"
                className="w-full bg-gray-950 border border-gray-700 rounded p-2 text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase">Bio / Directive</label>
              <input 
                type="text" 
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Primary function..."
                className="w-full bg-gray-950 border border-gray-700 rounded p-2 text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Mode Specific Content */}
          {mode === 'catalog' ? (
            <div className="space-y-3">
              <label className="text-xs font-bold text-gray-500 uppercase">Select Character</label>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-3 max-h-60 overflow-y-auto p-2 bg-gray-950 rounded border border-gray-800">
                {availableCharacters.map((char) => {
                  // Calculate sprite position for preview
                  const frameX = (char.frameIndex % 16) * 32;
                  const frameY = Math.floor(char.frameIndex / 16) * 32;
                  const isSelected = selectedCharacterId === char.id;
                  
                  return (
                    <button
                      key={char.id}
                      onClick={() => {
                        setSelectedCharacterId(char.id);
                        setSelectedJob(null); // Clear legacy job selection
                      }}
                      className={`aspect-square rounded-lg border-2 flex flex-col items-center justify-center relative group transition-all
                        ${isSelected ? 'border-emerald-500 bg-emerald-900/20' : 'border-gray-700 hover:border-gray-500 bg-gray-900'}
                      `}
                      title={char.name}
                    >
                      {/* Sprite preview */}
                      <div 
                        className="w-8 h-8"
                        style={{
                          backgroundImage: `url(${char.spritePath})`,
                          backgroundPosition: `-${frameX}px -${frameY}px`,
                          backgroundSize: '512px 512px',
                          imageRendering: 'pixelated',
                        }}
                      />
                      <span className="absolute bottom-1 text-[8px] text-gray-400 uppercase truncate w-full text-center px-1">
                        {char.category}
                      </span>
                    </button>
                  );
                })}
              </div>
              {selectedCharacterId && (
                <p className="text-xs text-emerald-400">
                  Selected: {getCharacterById(selectedCharacterId).name}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-purple-400 uppercase">AI Generation Prompt</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Describe your character (e.g. 'Cyberpunk ninja with neon armor')"
                    className="flex-1 bg-gray-950 border border-gray-700 rounded p-2 text-white focus:border-purple-500 focus:outline-none"
                  />
                  <button 
                    onClick={handleGenerate}
                    disabled={isGenerating || !prompt}
                    className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded font-medium transition-colors"
                  >
                    {isGenerating ? 'Generating...' : 'Generate'}
                  </button>
                </div>
                <p className="text-xs text-gray-500">Powered by Gemini 3 Pro Image (Nano Banana Pro)</p>
              </div>

              {/* Preview Area */}
              <div className="flex justify-center">
                <div className="w-32 h-32 bg-gray-950 border border-gray-700 rounded-lg flex items-center justify-center overflow-hidden relative">
                  {generatedImage ? (
                    <img src={generatedImage} alt="Generated Agent" className="w-full h-full object-contain pixelated" />
                  ) : (
                    <span className="text-gray-600 text-xs text-center px-2">
                      {isGenerating ? 'Processing...' : 'Preview will appear here'}
                    </span>
                  )}
                  {isGenerating && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-800 bg-gray-950 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleCreate}
            disabled={!name || (mode === 'catalog' && !selectedCharacterId && !selectedJob) || (mode === 'generate' && !generatedImage)}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded font-bold shadow-lg shadow-emerald-900/20 transition-all"
          >
            Create Agent
          </button>
        </div>

      </div>
    </div>
  );
};
