
import React, { useState, useRef } from 'react';
import { JobRole } from '../config/JobRegistry';
import { CHARACTER_REGISTRY, getCharacterById } from '../config/CharacterRegistry';
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
  
  // Generation & Editing State
  const [prompt, setPrompt] = useState('');
  const [editPrompt, setEditPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);

  // Model Options
  const [generationModel, setGenerationModel] = useState<'flash' | 'pro'>('flash');
  const [imageSize, setImageSize] = useState<'1K' | '2K' | '4K'>('1K');

  // Get all available characters from registry
  const availableCharacters = Object.values(CHARACTER_REGISTRY);

  const handleCreate = () => {
    if (!name) return;

    const newAgent: Partial<AgentData> = {
      name,
      bio: bio || 'A newly created digital entity.',
      state: 'idle',
      gridX: Math.floor(Math.random() * 20) + 10,
      gridY: Math.floor(Math.random() * 15) + 5,
    };

    if (mode === 'catalog') {
      if (selectedCharacterId) {
        const character = getCharacterById(selectedCharacterId);
        newAgent.spriteKey = character.id;
        newAgent.job = character.id; 
      } else if (selectedJob) {
        newAgent.job = selectedJob;
      }
    } else if (mode === 'generate' && generatedImage) {
      newAgent.job = 'TECH_DEV_MALE' as JobRole;
      newAgent.spriteKey = `gen_${Date.now()}`; // Unique key
      // In a real app, we would upload this image to the backend/ingestion
      // For this MVP, we pass the data URL, and MainScene would need to handle loading it
      // Since MainScene handles textures via keys, we might need a mechanism to add texture at runtime.
      // We'll dispatch a special event for the texture data in MainScene.
      (newAgent as any).textureData = generatedImage;
    }

    onCreate(newAgent);
    onClose();
  };

  const handleGenerate = async () => {
    if (!prompt) return;
    setIsGenerating(true);
    try {
      let imageUrl;
      if (generationModel === 'pro') {
        imageUrl = await ImageGenerationService.generateHighQualityAsset(prompt, imageSize);
      } else {
        imageUrl = await ImageGenerationService.generateCharacterSprite(prompt);
      }
      setGeneratedImage(imageUrl);
      setMode('generate'); // Switch to generate mode to show result
      setSelectedCharacterId(null); // Clear catalog selection
    } catch (error) {
      console.error("Generation failed", error);
      alert("Failed to generate image. Check API key and logs.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleEdit = async () => {
    if (!editPrompt) return;
    
    // Determine source image
    let sourceImageBase64 = generatedImage;

    // If editing a catalog image, we need to extract it from the atlas first
    if (mode === 'catalog' && selectedCharacterId) {
      try {
        sourceImageBase64 = await extractCharacterFromAtlas(selectedCharacterId);
      } catch (e) {
        console.error("Failed to extract atlas image", e);
        return;
      }
    }

    if (!sourceImageBase64) return;

    setIsEditing(true);
    try {
      const newImageUrl = await ImageGenerationService.editCharacterSprite(sourceImageBase64, editPrompt);
      setGeneratedImage(newImageUrl);
      
      // Switch UI to "Generate" mode since we now have a custom image
      setMode('generate');
      setSelectedCharacterId(null);
      setEditPrompt('');
    } catch (error) {
      console.error("Editing failed", error);
      alert("Failed to edit image.");
    } finally {
      setIsEditing(false);
    }
  };

  // Helper to draw the specific frame from the atlas onto a canvas and get base64
  const extractCharacterFromAtlas = (charId: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const char = getCharacterById(charId);
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.src = char.spritePath;
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject('Canvas context failed');
          return;
        }

        const frameX = (char.frameIndex % 16) * 32;
        const frameY = Math.floor(char.frameIndex / 16) * 32;
        
        ctx.drawImage(img, frameX, frameY, 32, 32, 0, 0, 32, 32);
        resolve(canvas.toDataURL('image/png'));
      };
      
      img.onerror = (err) => reject(err);
    });
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

          {/* Catalog Mode */}
          {mode === 'catalog' && (
            <div className="space-y-3">
              <label className="text-xs font-bold text-gray-500 uppercase">Select Character</label>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-3 max-h-60 overflow-y-auto p-2 bg-gray-950 rounded border border-gray-800">
                {availableCharacters.map((char) => {
                  const frameX = (char.frameIndex % 16) * 32;
                  const frameY = Math.floor(char.frameIndex / 16) * 32;
                  const isSelected = selectedCharacterId === char.id;
                  
                  return (
                    <button
                      key={char.id}
                      onClick={() => {
                        setSelectedCharacterId(char.id);
                        setSelectedJob(null);
                        setGeneratedImage(null); // Clear any generated image when picking from catalog
                      }}
                      className={`aspect-square rounded-lg border-2 flex flex-col items-center justify-center relative group transition-all
                        ${isSelected ? 'border-emerald-500 bg-emerald-900/20' : 'border-gray-700 hover:border-gray-500 bg-gray-900'}
                      `}
                      title={char.name}
                    >
                      <div 
                        className="w-8 h-8 transform scale-150"
                        style={{
                          backgroundImage: `url(${char.spritePath})`,
                          backgroundPosition: `-${frameX}px -${frameY}px`,
                          backgroundSize: '512px 512px',
                          imageRendering: 'pixelated',
                        }}
                      />
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
          )}

          {/* Generate Mode */}
          {mode === 'generate' && (
            <div className="space-y-4">
              
              {/* Model & Size Selector */}
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Model</label>
                  <select 
                    value={generationModel}
                    onChange={(e) => setGenerationModel(e.target.value as 'flash' | 'pro')}
                    className="w-full bg-gray-950 border border-gray-700 rounded p-2 text-white text-sm focus:border-purple-500 focus:outline-none"
                  >
                    <option value="flash">Gemini 2.5 Flash (Fast)</option>
                    <option value="pro">Gemini 3 Pro (High Quality)</option>
                  </select>
                </div>
                {generationModel === 'pro' && (
                  <div className="flex-1">
                    <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Image Size</label>
                    <select 
                      value={imageSize}
                      onChange={(e) => setImageSize(e.target.value as '1K' | '2K' | '4K')}
                      className="w-full bg-gray-950 border border-gray-700 rounded p-2 text-white text-sm focus:border-purple-500 focus:outline-none"
                    >
                      <option value="1K">1K (1024x1024)</option>
                      <option value="2K">2K (2048x2048)</option>
                      <option value="4K">4K (4096x4096)</option>
                    </select>
                  </div>
                )}
              </div>

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
              </div>

              {/* Preview Area */}
              <div className="flex justify-center">
                <div className="w-32 h-32 bg-gray-950 border border-gray-700 rounded-lg flex items-center justify-center overflow-hidden relative shadow-inner">
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

          {/* AI Editor - Available in both modes if an image is selected/generated */}
          {(generatedImage || (mode === 'catalog' && selectedCharacterId)) && (
            <div className="space-y-2 pt-4 border-t border-gray-800">
              <label className="text-xs font-bold text-blue-400 uppercase flex items-center gap-2">
                AI Magic Editor <span className="text-[10px] bg-blue-900/50 px-1 rounded text-blue-300 font-normal">Gemini 2.5 Flash</span>
              </label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={editPrompt}
                  onChange={(e) => setEditPrompt(e.target.value)}
                  placeholder={mode === 'catalog' ? "Edit selected character (e.g. 'Add a red hat')" : "Refine this image (e.g. 'Remove background')"}
                  className="flex-1 bg-gray-950 border border-gray-700 rounded p-2 text-white focus:border-blue-500 focus:outline-none text-sm"
                />
                <button 
                  onClick={handleEdit}
                  disabled={isEditing || !editPrompt}
                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded font-medium transition-colors text-sm"
                >
                  {isEditing ? 'Editing...' : 'Edit'}
                </button>
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
