
import { BuildingType, PlantType } from './src/config/EnvironmentRegistry';

export type AgentState = 'idle' | 'moving' | 'chatting';

export interface ChatMessage {
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
}

export interface AgentData {
  id: string;
  gridX: number;
  gridY: number;
  state: AgentState;
  lastMessage?: string;
  conversationPartnerId?: string;
  activeConversation?: ChatMessage[];
  name?: string; 
  bio?: string;  
  color?: number; 
  characterId?: number; // Index in the sprite sheet (0-63)
  job?: string; // Job role mapped to JOB_SKINS
}

// Environment Objects
export interface EnvironmentObject {
  id: string;
  type: 'building' | 'plant';
  gridX: number;
  gridY: number;
  width: number;
  height: number;
  color: number;
  secondaryColor?: number; // for details like roofs or leaf colors
}

export interface BuildingObject extends EnvironmentObject {
  type: 'building';
  buildingType: BuildingType;
  isPassable: boolean;
}

export interface PlantObject extends EnvironmentObject {
  type: 'plant';
  plantType: PlantType;
  canWalkThrough: boolean;
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
