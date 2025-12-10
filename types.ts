
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
  characterId?: number; // Index in the sprite sheet (0-63) - deprecated, use spriteKey
  job?: string; // Job role mapped to CHARACTER_REGISTRY
  spriteKey?: string; // Custom sprite texture key from CharacterRegistry
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
  onConversationUpdate?: (detail: ConversationStreamEventDetail) => void;
}

export const TILE_SIZE = 32;
export const TICK_DURATION = 1000; // Duration of one server tick in ms

// Conversation Protocol Types (Client-Server Communication)
export interface GenerateMessageRequest {
  conversationId: string;
  agentA: Pick<AgentData, 'id' | 'name' | 'bio' | 'job'>;
  agentB: Pick<AgentData, 'id' | 'name' | 'bio' | 'job'>;
  conversationHistory: ChatMessage[];
  turn: 'agentA' | 'agentB';
  messageCount: number;
  streaming?: boolean; // Request streaming (default: true)
  timestamp: number; // For replay protection
  nonce: string; // For replay protection (UUID)
}

export interface MessageGeneratedResponse {
  conversationId: string;
  success: boolean;
  message?: ChatMessage;
  error?: string;
  fallback?: boolean;
}

export interface StartConversationRequest {
  conversationId: string;
  agentAId: string;
  agentBId: string;
  topic?: string;
}

export interface EndConversationRequest {
  conversationId: string;
  reason: 'natural_end' | 'timeout' | 'error' | 'user_action';
  finalMessageCount: number;
}

export interface ConversationStateUpdate {
  conversationId: string;
  status: 'generating' | 'ready' | 'error';
  estimatedWaitTime?: number;
}

// Streaming Protocol Types
export interface StreamStartResponse {
  conversationId: string;
  requestId: string;
  senderId: string;
  senderName: string;
  estimatedLength?: number;
}

export interface MessageChunkResponse {
  conversationId: string;
  requestId: string;
  chunk: string;
  chunkIndex: number;
  isComplete: boolean;
  accumulatedText?: string;
}

export interface StreamCompleteResponse {
  conversationId: string;
  requestId: string;
  finalMessage: ChatMessage;
  success: boolean;
  totalChunks: number;
  duration?: number;
  messageHash?: string; // SHA-256 hex string for integrity
}

export interface StreamErrorResponse {
  conversationId: string;
  requestId: string;
  error: string;
  errorCode: 'api_error' | 'timeout' | 'rate_limit' | 'validation_error' | 'unknown';
  fallbackMessage?: ChatMessage;
  canRetry: boolean;
  retryAfter?: number;
}

export interface StreamCancelledResponse {
  conversationId: string;
  requestId: string;
  reason: 'timeout' | 'server_shutdown' | 'rate_limit' | 'user_cancelled';
}

// Partial message state for progressive UI updates
export interface PartialMessage {
  conversationId: string;
  requestId: string;
  accumulatedText: string;
  chunkCount: number;
  isComplete: boolean;
  senderId: string;
  senderName: string;
}

// Socket Payload Types
export interface ConversationStreamEventDetail {
  conversationId: string;
  partialMessage?: PartialMessage;
  status: 'typing' | 'streaming' | 'complete' | 'error' | 'cancelled';
  error?: string;
}
