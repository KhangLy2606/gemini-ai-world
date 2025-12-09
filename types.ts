
export type AgentState = 'idle' | 'moving' | 'chatting';

export interface AgentData {
  id: string;
  gridX: number;
  gridY: number;
  state: AgentState;
  lastMessage?: string;
  name?: string; 
  bio?: string;  
  color?: number; 
  characterId?: number; // Index in the sprite sheet (0-63)
}

export interface WorldUpdate {
  tick: number;
  agents: AgentData[];
}

// Props passed from React to Phaser Scene
export interface SceneInitData {
  onAgentSelect: (agent: AgentData) => void;
}

export const TILE_SIZE = 32;
export const TICK_DURATION = 1000; // Duration of one server tick in ms
