
import Phaser from 'phaser';
import { io, Socket } from 'socket.io-client';
import { AgentData, SceneInitData, WorldUpdate, TILE_SIZE, TICK_DURATION, ChatMessage, PartialMessage, StreamStartResponse, MessageChunkResponse, StreamCompleteResponse, StreamErrorResponse, StreamCancelledResponse, ConversationStreamEventDetail, GenerateMessageRequest } from '../types';
import { JOB_SKINS, JobRole } from '../src/config/JobRegistry';
import { getCharacterByJob, getCharacterById, CHARACTER_REGISTRY, CharacterDefinition } from '../src/config/CharacterRegistry';
import { EnvironmentManager } from '../src/game/EnvironmentManager';
import { EnvironmentRenderer } from '../src/game/EnvironmentRenderer';
import { CollisionManager } from '../src/game/CollisionManager';
import { 
  StreamStartResponseSchema, 
  MessageChunkSchema, 
  StreamCompleteResponseSchema, 
  StreamErrorResponseSchema, 
  StreamCancelledResponseSchema,
  GenerateMessageRequestSchema
} from '../src/validation/conversationSchemas';
import { sanitizeMessage, sanitizeError } from '../src/utils/sanitize';

interface ConversationScript {
    topic: string;
    messages: { senderIndex: 0 | 1; text: string }[];
}

const CONVERSATION_SCRIPTS: ConversationScript[] = [
    {
        topic: "Tech Talk",
        messages: [
            { senderIndex: 0, text: "Did you push the hotfix?" },
            { senderIndex: 1, text: "Yeah, but it broke the tests." },
            { senderIndex: 0, text: "Classic. Rollback?" },
            { senderIndex: 1, text: "Way ahead of you." }
        ]
    },
    {
        topic: "Coffee Break",
        messages: [
            { senderIndex: 0, text: "Coffee machine is down." },
            { senderIndex: 1, text: "No... tell me it's not true." },
            { senderIndex: 0, text: "I wish I was joking." },
            { senderIndex: 1, text: "Guess I'll power down then." }
        ]
    },
    {
        topic: "Philosophy",
        messages: [
            { senderIndex: 0, text: "Do you think we are in a simulation?" },
            { senderIndex: 1, text: "Only if the user is watching." },
            { senderIndex: 0, text: "That's deep." },
            { senderIndex: 1, text: "Or just rendering logic." }
        ]
    }
];

export class MainScene extends Phaser.Scene {
  private socket: Socket | null = null;
  private agents: Map<string, Phaser.GameObjects.Sprite> = new Map();
  private agentNameTags: Map<string, Phaser.GameObjects.Text> = new Map();
  private agentShadows: Map<string, Phaser.GameObjects.Graphics> = new Map();
  private onAgentSelect?: (agent: AgentData) => void;
  private onConversationUpdate?: (detail: ConversationStreamEventDetail) => void;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  
  // Store latest data to handle click selection
  private agentsDataStore: Map<string, AgentData> = new Map();

  // Environment System
  private environmentManager?: EnvironmentManager;
  private environmentRenderer?: EnvironmentRenderer;
  private collisionManager?: CollisionManager;

  // Mock Simulation State
  private useMockData = true; // Set to true to see the world without a backend
  private mockTickTimer?: Phaser.Time.TimerEvent;
  private mockAgents: AgentData[] = []; // Persistent mock agents array for agent creation
  
  // Conversation Director State
  private activeConversations: Map<string, {
      initiatorId: string;
      partnerId: string;
      script: ConversationScript;
      progress: number; // Index of the next message to send
      lastUpdateTick: number;
      // Streaming state (for real backend)
      isGenerating?: boolean;
      activeRequestId?: string;
      streamStartTime?: number;
      maxMessages?: number;
      // Streaming state for mock
      streamingMessage?: {
          text: string;
          sentChars: number;
          messageObject: ChatMessage;
          sender: AgentData;
          requestId: string;
      };
  }> = new Map();

  // Partial messages storage
  private partialMessages: Map<string, PartialMessage> = new Map();
  
  // Streaming timeout configuration
  private readonly STREAM_TIMEOUT_MS = 30000; // 30 seconds
  private streamTimeoutChecker?: Phaser.Time.TimerEvent;

  // Rate Limiting & Security
  private lastRequestTimes: Map<string, number> = new Map();
  private activeRequestCount = 0;
  private readonly MIN_REQUEST_INTERVAL = 3000; // 3 seconds
  private readonly MAX_CONCURRENT_REQUESTS = 5;
  private chunkTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private readonly CHUNK_TIMEOUT_MS = 5000; // 5 seconds
  private pendingRequests: Set<string> = new Set();

  // Zoom State
  private currentZoom = 2;
  private minZoom = 1;
  private maxZoom = 4;
  private zoomSpeed = 0.1;
  private zoomUI?: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'MainScene' });
  }

  init(data: SceneInitData) {
    this.onAgentSelect = data.onAgentSelect;
    this.onConversationUpdate = data.onConversationUpdate;
  }

  preload() {
    // Load new pixel art assets
    this.load.image('grass_tileset', '/assets/grass_tileset.png');
    this.load.spritesheet('water_tileset', '/assets/water_tileset.png', { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('path_tileset', '/assets/path_tileset.png', { frameWidth: 32, frameHeight: 32 });
    
    this.load.spritesheet('minions_atlas', '/assets/minions_atlas.png', { 
        frameWidth: 32, 
        frameHeight: 32 
    });
    
    this.load.spritesheet('buildings_atlas', '/assets/buildings_atlas.png', { 
        frameWidth: 32, 
        frameHeight: 32 
    });
    
    this.load.spritesheet('plants_props_atlas', '/assets/plants_props_atlas.png', { 
        frameWidth: 32, 
        frameHeight: 32 
    });

    // Load the character sprite sheet.
    // Adjusted to use 'agent_atlas' and 32x32 size as requested
    this.load.spritesheet('agent_atlas', '/assets/jobs_atlas.png', { 
      frameWidth: 32, 
      frameHeight: 32 
    });
    
    this.load.image('tileset', 'https://labs.phaser.io/assets/tilemaps/tiles/super-mario.png'); // Placeholder tiles
  }

  create() {
    this.events.on(Phaser.Scenes.Events.SHUTDOWN, this.shutdownScene, this);
    this.events.on(Phaser.Scenes.Events.DESTROY, this.shutdownScene, this);

    // Listen for agent creation events from React
    window.addEventListener('create-agent', this.handleCreateAgentEvent as EventListener);

    this.createWorld();
    this.setupSocket();
    this.setupInput();
    this.setupZoomControls();
    // Note: Animations removed - using single-frame static sprites

    // Generate fallback textures if assets failed to load (for robust demo)
    if (!this.textures.exists('characters')) {
        this.createFallbackTextures();
    }

    // Camera Setup
    this.cameras.main.setZoom(2);
    this.cameras.main.centerOn(400, 300);
    this.cameras.main.setBackgroundColor('#3a5a3a'); // Match game background color (lighter green-tinted)
    
    // Add post-processing effects for visual polish
    this.addPostProcessingEffects();

    if (this.input.keyboard) {
        this.cursors = this.input.keyboard.createCursorKeys();
    }

    // Start Mock Simulation if enabled
    if (this.useMockData) {
        this.startMockSimulation();
    }
  }

  /**
   * Get character definition from agent data
   * Uses spriteKey if available, otherwise looks up by job
   */
  private getCharacterForAgent(agentData: AgentData): CharacterDefinition {
    // First check for custom spriteKey
    if (agentData.spriteKey && CHARACTER_REGISTRY[agentData.spriteKey]) {
      return CHARACTER_REGISTRY[agentData.spriteKey];
    }
    
    // Fall back to job-based lookup
    if (agentData.job) {
      return getCharacterByJob(agentData.job);
    }
    
    // Default fallback
    return getCharacterById('TECH_DEV_MALE');
  }

  /**
   * Add post-processing effects for visual polish
   * Includes: subtle vignette, color grading, and optional scanlines
   */
  private addPostProcessingEffects(): void {
    // Add subtle vignette overlay (reduced intensity)
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    
    const vignetteGraphics = this.add.graphics();
    vignetteGraphics.setScrollFactor(0);
    vignetteGraphics.setDepth(10000);
    
    // Radial gradient vignette (lighter, less intense)
    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.sqrt(centerX * centerX + centerY * centerY);
    
    for (let radius = maxRadius; radius > 0; radius -= 10) {
      const alpha = Math.max(0, Math.min(0.2, (radius / maxRadius - 0.6) * 0.5));
      vignetteGraphics.fillStyle(0x000000, alpha * 0.15); // Reduced from 0.3 to 0.15
      vignetteGraphics.fillCircle(centerX, centerY, radius);
    }
    
    // Optional: Matrix-themed green tint (subtle)
    const tintGraphics = this.add.graphics();
    tintGraphics.setScrollFactor(0);
    tintGraphics.setDepth(9999);
    tintGraphics.fillStyle(0x00ff88, 0.01); // Reduced from 0.02 to 0.01
    tintGraphics.fillRect(0, 0, width, height);
    
    // Optional: CRT scanlines effect (lighter)
    const scanlinesGraphics = this.add.graphics();
    scanlinesGraphics.setScrollFactor(0);
    scanlinesGraphics.setDepth(9998);
    scanlinesGraphics.lineStyle(1, 0x000000, 0.02); // Reduced from 0.05 to 0.02
    
    for (let y = 0; y < height; y += 4) {
      scanlinesGraphics.lineBetween(0, y, width, y);
    }
  }

  private handleCreateAgentEvent = (event: CustomEvent<Partial<AgentData>>) => {
    const newAgent = event.detail;
    console.log("MainScene received new agent:", newAgent);
    
    // For the mock simulation, add the agent to our persistent mockAgents array
    if (this.useMockData) {
        const id = `custom-${Date.now()}`;
        const agentData: AgentData = {
            id,
            gridX: newAgent.gridX || Math.floor(Math.random() * 20) + 10,
            gridY: newAgent.gridY || Math.floor(Math.random() * 15) + 5,
            state: 'idle',
            name: newAgent.name || 'Custom Agent',
            bio: newAgent.bio || 'User generated.',
            job: newAgent.job || 'TECH_DEV_MALE',
            spriteKey: newAgent.spriteKey, // Support custom character sprites
            color: Math.random() * 0xffffff,
            lastMessage: "Hello world! I am new here.",
            activeConversation: []
        };
        
        // Add to the persistent mockAgents array
        this.mockAgents.push(agentData);
        
        console.log(`Agent "${agentData.name}" added to mock simulation. Total agents: ${this.mockAgents.length}`);
    }
  };

  private shutdownScene() {
    window.removeEventListener('create-agent', this.handleCreateAgentEvent as EventListener);
    if (this.mockTickTimer) this.mockTickTimer.remove();
    if (this.streamTimeoutChecker) this.streamTimeoutChecker.remove();
    if (this.socket) {
        this.socket.disconnect();
        this.socket = null;
    }
    
    // Cleanup streaming state
    this.partialMessages.clear();
    this.activeConversations.clear();
    
    // Cleanup environment
    if (this.environmentRenderer) {
      this.environmentRenderer.destroy();
    }
  }
      // Create a generative texture for agents if image is missing
  private createFallbackTextures() {
      // Create a generative texture for agents if image is missing
      const graphics = this.make.graphics({ x: 0, y: 0 }, false);
      
      // Draw 10 different colored squares as frames
      for (let i = 0; i < 10; i++) {
          graphics.fillStyle(0xffffff, 1);
          graphics.fillRect(i * 32, 0, 32, 32);
          graphics.fillStyle(Math.random() * 0xffffff, 1);
          graphics.fillRect(i * 32 + 4, 4, 24, 24);
          // Eyes
          graphics.fillStyle(0x000000, 1);
          graphics.fillRect(i * 32 + 8, 10, 4, 4);
          graphics.fillRect(i * 32 + 20, 10, 4, 4);
      }
      graphics.generateTexture('characters', 320, 32);
      
      // Manually add frames to the new texture
      for (let i = 0; i < 10; i++) {
          this.textures.get('characters').add(i, 0, i * 32, 0, 32, 32);
      }
  }

  private createWorld() {
    // World dimensions
    const width = 40; // grid units
    const height = 30;
    
    // Initialize Environment Manager with a fixed seed for deterministic generation
    // In a real app, this seed could come from the server or user input
    const seed = 12345;
    this.environmentManager = new EnvironmentManager(width, height, seed);
    const environment = this.environmentManager.generateEnvironment();

    // Initialize Collision Manager
    this.collisionManager = new CollisionManager(this.environmentManager);

    // Initialize Environment Renderer
    this.environmentRenderer = new EnvironmentRenderer(this, seed);
    
    // Render the complete environment
    this.environmentRenderer.render(
      width, 
      height, 
      environment.buildings, 
      environment.plants
    );
    
    // Set world bounds
    this.cameras.main.setBounds(0, 0, width * TILE_SIZE, height * TILE_SIZE);
  }

  private getAuthToken(): string | null {
    // Option 1: Session-based (for web apps)
    return sessionStorage.getItem('auth_token');
    
    // Option 2: JWT from login
    // return localStorage.getItem('jwt_token');
    
    // Option 3: API key for service-to-service
    // return import.meta.env.VITE_API_KEY;
  }

  private validateSocketUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      // Only allow ws:// or wss://
      return parsed.protocol === 'ws:' || parsed.protocol === 'wss:';
    } catch {
      return false;
    }
  }

  private setupSocket() {
    const isProduction = import.meta.env.PROD;
    // Get from environment variable
    const defaultUrl = import.meta.env.DEV 
      ? 'ws://localhost:3000' 
      : 'wss://api.yourdomain.com';
    
    const url = import.meta.env.VITE_SOCKET_URL || defaultUrl;
    
    // Validate URL format
    if (!this.validateSocketUrl(url)) {
      console.error('Invalid socket URL format, falling back to default');
    }

    if (isProduction && !url.startsWith('wss://')) {
        throw new Error('Secure WebSocket (WSS) required in production');
    }
    
    const token = this.getAuthToken();

    this.socket = io(url, {
      transports: ['websocket'],
      autoConnect: true,
      reconnectionAttempts: 3,
      auth: {
        token: token || undefined, // Send token if available
      },
    });

    this.socket.on('connect', () => {
      if (import.meta.env.DEV) console.log('Connected to backend');
      this.useMockData = false; // Disable mock if real server connects
      if (this.mockTickTimer) this.mockTickTimer.remove();
      this.socket?.emit('join_world');
      
      // Setup streaming event handlers when connected
      this.setupStreamingSocketHandlers();
      // Start timeout checker
      this.setupStreamTimeoutChecker();
    });

    this.socket.on('connect_error', (error) => {
      if (error.message === 'Authentication failed') {
        console.error('[Security] Authentication failed');
        // Redirect to login or show error
      }
    });
    
    this.socket.on('disconnect', () => {
      console.log('Disconnected from backend');
      // Fallback to mock mode
      this.useMockData = true;
      this.startMockSimulation();
    });

    this.socket.on('server_tick', (update: WorldUpdate) => {
      this.handleServerTick(update);
    });
  }
  
  /**
   * Setup Socket.io event handlers for streaming conversation protocol
   * Implements: stream_start, message_chunk, stream_complete, stream_error, stream_cancelled
   */
  private setupStreamingSocketHandlers(): void {
    if (!this.socket) return;
    
    // Stream Start - Server acknowledges and begins generation
    this.socket.on('conversation:stream_start', (response: unknown) => {
      try {
        const validated = StreamStartResponseSchema.parse(response);
        if (import.meta.env.DEV) {
            console.log('[Streaming] Stream started:', validated.conversationId);
        }
        
        // Request started successfully, clear pending
        this.pendingRequests.delete(validated.conversationId);
        
        const state = this.activeConversations.get(validated.conversationId);
        if (!state) {
          console.warn('[Streaming] Received stream_start for unknown conversation:', validated.conversationId);
          return;
        }
        
        state.activeRequestId = validated.requestId;
        state.streamStartTime = Date.now();
        
        // Initialize partial message
        const partial: PartialMessage = {
          conversationId: validated.conversationId,
          requestId: validated.requestId,
          accumulatedText: '',
          chunkCount: 0,
          isComplete: false,
          senderId: validated.senderId,
          senderName: validated.senderName,
        };
        
        this.partialMessages.set(validated.requestId, partial);
        
        // Notify UI that typing is starting
        if (this.onConversationUpdate) {
          this.onConversationUpdate({
            conversationId: validated.conversationId,
            status: 'typing',
          });
        }
      } catch (error) {
        console.error('[Security] Invalid stream_start format:', error);
      }
    });
    
    // Message Chunk - Receive a piece of the message
    this.socket.on('conversation:message_chunk', (response: unknown) => {
      try {
        const validated = MessageChunkSchema.parse(response);
        
        const partial = this.partialMessages.get(validated.requestId);
        if (!partial) {
          console.warn('[Security] Received chunk for unknown request');
          return;
        }
        
        // Clear previous timeout
        const existing = this.chunkTimeouts.get(validated.requestId);
        if (existing) clearTimeout(existing);
        
        // Set new timeout
        const timeout = setTimeout(() => {
          console.warn('[Security] Chunk timeout');
          // Handle timeout logic if needed, or just log
        }, this.CHUNK_TIMEOUT_MS);
        
        this.chunkTimeouts.set(validated.requestId, timeout);

        // Sanitize chunk before accumulating
        const sanitizedChunk = sanitizeMessage(validated.chunk);
        partial.accumulatedText += sanitizedChunk;
        partial.chunkCount = validated.chunkIndex + 1;
        partial.isComplete = validated.isComplete;
        
        // Update partial message
        this.partialMessages.set(validated.requestId, partial);
        
        // Notify UI with progressive update
        if (this.onConversationUpdate) {
          this.onConversationUpdate({
            conversationId: validated.conversationId,
            partialMessage: partial,
            status: 'streaming',
          });
        }
      } catch (error) {
        console.error('[Security] Invalid chunk format:', error);
      }
    });
    
    // Stream Complete - Message fully received
    this.socket.on('conversation:stream_complete', (response: unknown) => {
      try {
        const validated = StreamCompleteResponseSchema.parse(response);
        if (import.meta.env.DEV) {
            console.log('[Streaming] Stream complete:', validated.conversationId, 'chunks:', validated.totalChunks);
        }
        
        // Ensure pending is cleared
        this.pendingRequests.delete(validated.conversationId);
        
        // Update rate limiting
        this.activeRequestCount = Math.max(0, this.activeRequestCount - 1);
        this.lastRequestTimes.delete(validated.conversationId);

        const state = this.activeConversations.get(validated.conversationId);
        const partial = this.partialMessages.get(validated.requestId);
        
        if (!state || !partial) {
          console.warn('[Streaming] Stream complete for unknown conversation/request');
          return;
        }
        
        // Clear chunk timeout
        const existingTimeout = this.chunkTimeouts.get(validated.requestId);
        if (existingTimeout) {
            clearTimeout(existingTimeout);
            this.chunkTimeouts.delete(validated.requestId);
        }

        // Get agents
        const agentA = this.mockAgents.find(a => a.id === state.initiatorId);
        const agentB = this.mockAgents.find(a => a.id === state.partnerId);
        
        if (agentA && agentB) {
          // Add complete message to both agents' history
          agentA.activeConversation = agentA.activeConversation || [];
          agentB.activeConversation = agentB.activeConversation || [];
          
          // Sanitize final message just in case
          validated.finalMessage.text = sanitizeMessage(validated.finalMessage.text);

          agentA.activeConversation.push(validated.finalMessage);
          agentB.activeConversation.push(validated.finalMessage);
          
          agentA.lastMessage = validated.finalMessage.text;
          agentB.lastMessage = validated.finalMessage.text;
          
          // Update state
          state.isGenerating = false;
          state.activeRequestId = undefined;
          state.progress++;
          state.lastUpdateTick = this.time.now;
        }
        
        // Cleanup partial message
        this.partialMessages.delete(validated.requestId);
        
        // Notify UI
        if (this.onConversationUpdate) {
          this.onConversationUpdate({
            conversationId: validated.conversationId,
            status: 'complete',
          });
        }
      } catch (error) {
        console.error('[Security] Invalid stream_complete format:', error);
      }
    });
    
    // Stream Error - Handle errors during streaming
    this.socket.on('conversation:stream_error', (response: unknown) => {
      try {
        const validated = StreamErrorResponseSchema.parse(response);
        
        // Sanitize error before logging
        const sanitizedError = sanitizeError(validated.error);
        console.error('[Streaming] Stream error:', validated.errorCode, sanitizedError);
        
        // Ensure pending is cleared
        this.pendingRequests.delete(validated.conversationId);

        // Update rate limiting
        this.activeRequestCount = Math.max(0, this.activeRequestCount - 1);
        this.lastRequestTimes.delete(validated.conversationId);

        const state = this.activeConversations.get(validated.conversationId);
        if (!state) return;
        
        // Cleanup partial message
        if (state.activeRequestId) {
          this.partialMessages.delete(state.activeRequestId);
          const existingTimeout = this.chunkTimeouts.get(state.activeRequestId);
          if (existingTimeout) {
             clearTimeout(existingTimeout);
             this.chunkTimeouts.delete(state.activeRequestId);
          }
        }
        
        state.isGenerating = false;
        state.activeRequestId = undefined;
        
        // Handle fallback message if provided
        if (validated.fallbackMessage) {
          const agentA = this.mockAgents.find(a => a.id === state.initiatorId);
          const agentB = this.mockAgents.find(a => a.id === state.partnerId);
          
          if (agentA && agentB) {
            agentA.activeConversation = agentA.activeConversation || [];
            agentB.activeConversation = agentB.activeConversation || [];
            
            validated.fallbackMessage.text = sanitizeMessage(validated.fallbackMessage.text);

            agentA.activeConversation.push(validated.fallbackMessage);
            agentB.activeConversation.push(validated.fallbackMessage);
            
            agentA.lastMessage = validated.fallbackMessage.text;
            agentB.lastMessage = validated.fallbackMessage.text;
            
            state.progress++;
            state.lastUpdateTick = this.time.now;
          }
        } else {
          // No fallback - end conversation or retry
          if (validated.canRetry && validated.retryAfter) {
            // Schedule retry after retryAfter seconds
            this.time.delayedCall((validated.retryAfter) * 1000, () => {
              this.retryMessageGeneration(validated.conversationId);
            });
          } else {
            // End conversation gracefully
            this.endConversation(validated.conversationId, 'error');
          }
        }
        
        // Notify UI
        if (this.onConversationUpdate) {
          this.onConversationUpdate({
            conversationId: validated.conversationId,
            status: 'error',
            error: sanitizedError, // SANITIZED
          });
        }
      } catch (error) {
         console.error('[Security] Invalid stream_error format:', error);
      }
    });
    
    // Stream Cancelled - Stream was cancelled before completion
    this.socket.on('conversation:stream_cancelled', (response: unknown) => {
      try {
        const validated = StreamCancelledResponseSchema.parse(response);
        if (import.meta.env.DEV) {
            console.log('[Streaming] Stream cancelled:', validated.conversationId, 'reason:', validated.reason);
        }
        
        // Ensure pending is cleared
        this.pendingRequests.delete(validated.conversationId);
        
        const state = this.activeConversations.get(validated.conversationId);
        if (!state) return;
        
        // Cleanup
        if (state.activeRequestId) {
          this.partialMessages.delete(state.activeRequestId);
          const existingTimeout = this.chunkTimeouts.get(state.activeRequestId);
          if (existingTimeout) {
              clearTimeout(existingTimeout);
              this.chunkTimeouts.delete(state.activeRequestId);
          }
        }
        
        state.isGenerating = false;
        state.activeRequestId = undefined;
        
        // Notify UI
        if (this.onConversationUpdate) {
          this.onConversationUpdate({
            conversationId: validated.conversationId,
            status: 'cancelled',
          });
        }
      } catch (error) {
        console.error('[Security] Invalid stream_cancelled format:', error);
      }
    });
  }
  
  /**
   * Request message generation from the backend with streaming
   */
  private requestMessageGeneration(
    convId: string,
    agentA: AgentData,
    agentB: AgentData,
    turn: 'agentA' | 'agentB'
  ): void {
    const state = this.activeConversations.get(convId);
    if (!state || state.isGenerating) return;
    
    // Request Deduplication
    if (this.pendingRequests.has(convId)) {
        console.warn('[Security] Request already pending for', convId);
        return;
    }

    // Rate Limiting
    const now = Date.now();
    const lastRequest = this.lastRequestTimes.get(convId);
    if (lastRequest && (now - lastRequest) < this.MIN_REQUEST_INTERVAL) {
        console.warn('[Security] Rate limit: Too many requests for conversation', convId);
        return;
    }
    
    if (this.activeRequestCount >= this.MAX_CONCURRENT_REQUESTS) {
        console.warn('[Security] Rate limit: Too many concurrent requests');
        return;
    }

    // Limit conversation history size and total characters
    const MAX_HISTORY_MESSAGES = 50;
    const MAX_TOTAL_CHARS = 10000;

    const history = (agentA.activeConversation || [])
      .slice(-MAX_HISTORY_MESSAGES)
      .reduce((acc, msg) => {
        const totalSize = acc.reduce((sum, m) => sum + m.text.length, 0);
        if (totalSize + msg.text.length <= MAX_TOTAL_CHARS) {
          acc.push(msg);
        }
        return acc;
      }, [] as ChatMessage[]);

    const request: GenerateMessageRequest = {
      conversationId: convId,
      agentA: {
        id: agentA.id,
        name: agentA.name,
        bio: agentA.bio,
        job: agentA.job
      },
      agentB: {
        id: agentB.id,
        name: agentB.name,
        bio: agentB.bio,
        job: agentB.job
      },
      conversationHistory: history,
      turn: turn,
      messageCount: state.progress,
      streaming: true, // Request streaming response
      timestamp: Date.now(),
      nonce: crypto.randomUUID(), // Replay protection
    };
    
    try {
        const validated = GenerateMessageRequestSchema.parse(request);
        
        // Update rate limit tracking
        this.lastRequestTimes.set(convId, now);
        this.activeRequestCount++;
        this.pendingRequests.add(convId);
        state.isGenerating = true;

        if (import.meta.env.DEV) {
            console.log('[Streaming] Requesting message generation:', convId);
        }
        this.socket?.emit('conversation:generate_message', validated);
    } catch (error) {
        console.error('[Security] Invalid request format:', error);
        state.isGenerating = false;
        // Don't send invalid request
    } finally {
        // We keep pendingRequests set until we get a response (start, error, or complete)
        // But for safety, clear it here if validation failed
        // Ideally we clear it in the event handlers.
        // However, if emit fails silently, we might be stuck.
        // But socket.io emit is async only if we use callbacks.
        // Let's assume event handlers will clear it.
        // Actually, for simplicity and to prevent "stuck" pending state if server drops it:
        // We'll clear it in the event handlers.
    }
  }
  
  /**
   * Retry message generation after an error
   */
  private retryMessageGeneration(convId: string): void {
    const state = this.activeConversations.get(convId);
    if (!state) return;
    
    const agentA = this.mockAgents.find(a => a.id === state.initiatorId);
    const agentB = this.mockAgents.find(a => a.id === state.partnerId);
    
    if (agentA && agentB) {
      // Determine whose turn it is based on progress
      const turn: 'agentA' | 'agentB' = state.progress % 2 === 0 ? 'agentA' : 'agentB';
      this.requestMessageGeneration(convId, agentA, agentB, turn);
    }
  }
  
  /**
   * End a conversation gracefully
   */
  private endConversation(convId: string, reason: 'natural_end' | 'timeout' | 'error' | 'user_action'): void {
    const state = this.activeConversations.get(convId);
    if (!state) return;
    
    const agentA = this.mockAgents.find(a => a.id === state.initiatorId);
    const agentB = this.mockAgents.find(a => a.id === state.partnerId);
    
    if (agentA) {
      agentA.state = 'idle';
      agentA.conversationPartnerId = undefined;
    }
    if (agentB) {
      agentB.state = 'idle';
      agentB.conversationPartnerId = undefined;
    }
    
    // Notify backend
    this.socket?.emit('conversation:end', {
      conversationId: convId,
      reason: reason,
      finalMessageCount: state.progress
    });
    
    // Cleanup
    if (state.activeRequestId) {
      this.partialMessages.delete(state.activeRequestId);
    }
    this.activeConversations.delete(convId);
    
    // Notify UI
    if (this.onConversationUpdate) {
      this.onConversationUpdate({
        conversationId: convId,
        status: 'complete',
      });
    }
  }
  
  /**
   * Setup periodic timeout checking for streaming requests
   */
  private setupStreamTimeoutChecker(): void {
    // Check every second for timed-out streams
    this.streamTimeoutChecker = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        this.checkStreamTimeouts();
      }
    });
  }
  
  /**
   * Check for and handle timed-out streaming requests
   */
  private checkStreamTimeouts(): void {
    const now = Date.now();
    
    for (const [convId, state] of this.activeConversations.entries()) {
      if (state.isGenerating && state.streamStartTime) {
        const elapsed = now - state.streamStartTime;
        
        if (elapsed > this.STREAM_TIMEOUT_MS) {
          console.warn(`[Streaming] Timeout for conversation ${convId}`);
          
          // Cleanup partial message
          if (state.activeRequestId) {
            this.partialMessages.delete(state.activeRequestId);
          }
          
          state.isGenerating = false;
          state.activeRequestId = undefined;
          state.streamStartTime = undefined;
          
          // Notify UI of timeout
          if (this.onConversationUpdate) {
            this.onConversationUpdate({
              conversationId: convId,
              status: 'error',
              error: 'Request timed out',
            });
          }
          
          // End conversation or retry
          this.endConversation(convId, 'timeout');
        }
      }
    }
  }

  private setupInput() {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        // Drag to pan camera
        const touchStartX = pointer.x;
        const touchStartY = pointer.y;
        const camStartX = this.cameras.main.scrollX;
        const camStartY = this.cameras.main.scrollY;

        this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
             if (!p.isDown) return;
             this.cameras.main.scrollX = camStartX + (touchStartX - p.x) / this.cameras.main.zoom;
             this.cameras.main.scrollY = camStartY + (touchStartY - p.y) / this.cameras.main.zoom;
        });
    });
  }

  private setupZoomControls(): void {
    // Mouse wheel zoom
    this.input.on('wheel', (pointer: Phaser.Input.Pointer, gameObjects: Phaser.GameObjects.GameObject[], deltaX: number, deltaY: number) => {
      // deltaY is positive for scrolling down (zoom out), negative for scrolling up (zoom in)
      const zoomDelta = deltaY > 0 ? -this.zoomSpeed : this.zoomSpeed;
      this.setZoom(this.currentZoom + zoomDelta);
    });

    // Keyboard zoom controls (+ and - keys, or [ and ])
    if (this.input.keyboard) {
      this.input.keyboard.on('keydown', (event: KeyboardEvent) => {
        if (event.key === '+' || event.key === '=') {
          this.setZoom(this.currentZoom + this.zoomSpeed);
        } else if (event.key === '-' || event.key === '_') {
          this.setZoom(this.currentZoom - this.zoomSpeed);
        } else if (event.key === '[') {
          this.setZoom(this.currentZoom - this.zoomSpeed);
        } else if (event.key === ']') {
          this.setZoom(this.currentZoom + this.zoomSpeed);
        }
      });
    }

    // Create zoom level indicator UI
    this.createZoomIndicator();
  }

  private setZoom(zoom: number): void {
    // Clamp zoom between min and max
    this.currentZoom = Math.max(this.minZoom, Math.min(this.maxZoom, zoom));
    
    // Smooth zoom with tween
    this.tweens.add({
      targets: this.cameras.main,
      zoom: this.currentZoom,
      duration: 200,
      ease: 'Quad.easeOut'
    });

    // Update zoom indicator
    if (this.zoomUI) {
      this.zoomUI.setText(`Zoom: ${(this.currentZoom * 100).toFixed(0)}%`);
    }
  }

  private createZoomIndicator(): void {
    this.zoomUI = this.add.text(20, 80, `Zoom: ${(this.currentZoom * 100).toFixed(0)}%`, {
      fontSize: '12px',
      fontFamily: 'monospace',
      color: '#00ff88',
      backgroundColor: '#000000aa',
      padding: { x: 6, y: 3 }
    });
    this.zoomUI.setScrollFactor(0);
    this.zoomUI.setDepth(11000);
    this.zoomUI.setOrigin(0);
  }

  // --- MOCK SIMULATION FOR DEMO ---
  private startMockSimulation() {
      console.log("Starting Mock Simulation with Conversation Engine...");
      
      // Initialize mockAgents using the class property for persistence
      this.mockAgents = [];
      const names = ["Neo", "Trinity", "Morpheus", "Smith", "Oracle", "Cypher", "Tank", "Dozer"];
      
      // Initialize random agents
      for(let i=0; i<15; i++) {
          this.mockAgents.push({
              id: `mock-${i}`,
              gridX: Math.floor(Math.random() * 20) + 5,
              gridY: Math.floor(Math.random() * 15) + 5,
              state: 'idle',
              name: names[i % names.length],
              bio: `A simulated entity generated for world population. ID: ${i}`,
              characterId: i % 10,
              color: Math.random() * 0xffffff,
              job: (Object.keys(JOB_SKINS) as JobRole[])[Math.floor(Math.random() * Object.keys(JOB_SKINS).length)],
              activeConversation: []
          });
      }

      let tickCount = 0;

      this.mockTickTimer = this.time.addEvent({
          delay: TICK_DURATION,
          loop: true,
          callback: () => {
              tickCount++;
              
              // 1. Manage Active Conversations
              const agentsInConversation = new Set<string>();

              // Update existing conversations
              for (const [convId, state] of this.activeConversations.entries()) {
                  agentsInConversation.add(state.initiatorId);
                  agentsInConversation.add(state.partnerId);

                  const initiator = this.mockAgents.find(a => a.id === state.initiatorId);
                  const partner = this.mockAgents.find(a => a.id === state.partnerId);

                  if (!initiator || !partner) {
                      this.activeConversations.delete(convId); // Cleanup if agents missing
                      continue;
                  }

                  // Advance conversation every 2 ticks for pacing
                  // If we are currently streaming a message...
                  if (state.streamingMessage) {
                      // Stream chunks
                      const charsPerTick = 5; // Stream 5 chars at a time
                      const msg = state.streamingMessage;
                      
                      if (msg.sentChars < msg.text.length) {
                          const nextChars = msg.text.substr(msg.sentChars, charsPerTick);
                          msg.sentChars += nextChars.length;
                          
                          // Update partial message
                          // Simulate obtaining this from "socket" event
                          
                          // Find existing partial or create new
                          let partial = this.partialMessages.get(msg.requestId);
                          if (!partial) {
                              partial = {
                                  conversationId: convId,
                                  requestId: msg.requestId,
                                  accumulatedText: '',
                                  chunkCount: 0,
                                  isComplete: false,
                                  senderId: msg.sender.id,
                                  senderName: msg.sender.name || msg.sender.id
                              };
                              this.partialMessages.set(msg.requestId, partial);
                              
                              if (this.onConversationUpdate) {
                                  this.onConversationUpdate({
                                      conversationId: convId,
                                      partialMessage: partial,
                                      status: 'streaming'
                                  });
                              }
                          }
                          
                          partial.accumulatedText = msg.text.substring(0, msg.sentChars);
                          partial.chunkCount++;
                          
                          if (this.onConversationUpdate) {
                              this.onConversationUpdate({
                                  conversationId: convId,
                                  partialMessage: partial,
                                  status: 'streaming'
                              });
                          }

                          // If done streaming
                          if (msg.sentChars >= msg.text.length) {
                              // Message complete
                              partial.isComplete = true;
                              
                              // Push to agents history
                              // Actually, we should do this only when complete
                              const initiator = this.mockAgents.find(a => a.id === state.initiatorId);
                              const partner = this.mockAgents.find(a => a.id === state.partnerId);
                              
                              if (initiator && partner) {
                                  initiator.activeConversation?.push(msg.messageObject);
                                  partner.activeConversation?.push(msg.messageObject);
                                  
                                  initiator.lastMessage = msg.text;
                                  partner.lastMessage = msg.text;
                              }
                              
                              if (this.onConversationUpdate) {
                                  this.onConversationUpdate({
                                      conversationId: convId,
                                      partialMessage: partial, // Send final partial
                                      status: 'complete'
                                  });
                              }
                              
                              // Clear streaming state
                              state.streamingMessage = undefined;
                              state.progress++;
                              state.lastUpdateTick = tickCount;
                              
                              // Clean up partial after a moment
                              // this.partialMessages.delete(msg.requestId); // Keep for UI to display?
                          }
                      }
                  } else if (tickCount - state.lastUpdateTick >= 5) { // Slow down start of new messages
                      if (state.progress < state.script.messages.length) {
                          const msgDef = state.script.messages[state.progress];
                          const sender = msgDef.senderIndex === 0 ? initiator : partner;
                          const messageText = msgDef.text;
                          
                          // Start streaming new message
                          const requestId = `req-${Date.now()}`;
                          const chatMsg: ChatMessage = {
                              senderId: sender.id,
                              senderName: sender.name || sender.id,
                              text: messageText,
                              timestamp: Date.now()
                          };
                          
                          state.streamingMessage = {
                              text: messageText,
                              sentChars: 0,
                              messageObject: chatMsg,
                              sender: sender,
                              requestId: requestId
                          };
                          
                          // Notify UI of start (Thinking...)
                          if (this.onConversationUpdate) {
                             this.onConversationUpdate({
                                 conversationId: convId,
                                 status: 'typing'
                             });
                          }

                      } else {
                          // Conversation ended
                          this.activeConversations.delete(convId);
                          initiator.state = 'idle';
                          partner.state = 'idle';
                          
                          // Notify UI
                          if (this.onConversationUpdate) {
                              this.onConversationUpdate({
                                  conversationId: convId,
                                  status: 'complete'
                              });
                          }
                          
                          initiator.conversationPartnerId = undefined;
                          partner.conversationPartnerId = undefined;
                      }
                  }
              }

              // 2. Start New Conversations (Randomly pair idle agents)
              // Filter available agents
              const availableAgents = this.mockAgents.filter(a => !agentsInConversation.has(a.id) && a.state === 'idle');
              
              if (availableAgents.length >= 2 && Math.random() > 0.7) {
                  // Pick two random agents
                  const idx1 = Math.floor(Math.random() * availableAgents.length);
                  let idx2 = Math.floor(Math.random() * availableAgents.length);
                  while (idx1 === idx2) idx2 = Math.floor(Math.random() * availableAgents.length);

                  const agentA = availableAgents[idx1];
                  const agentB = availableAgents[idx2];
                  
                  // Start conversation
                  const script = CONVERSATION_SCRIPTS[Math.floor(Math.random() * CONVERSATION_SCRIPTS.length)];
                  const convId = `conv-${tickCount}-${agentA.id}`;
                  
                  this.activeConversations.set(convId, {
                      initiatorId: agentA.id,
                      partnerId: agentB.id,
                      script: script,
                      progress: 0,
                      lastUpdateTick: tickCount
                  });

                  // Initialize State
                  agentA.state = 'chatting';
                  agentB.state = 'chatting';
                  agentA.conversationPartnerId = agentB.id;
                  agentB.conversationPartnerId = agentA.id;
                  agentA.activeConversation = []; // Clear old history
                  agentB.activeConversation = []; // Clear old history
                  
                  // Immediate first message (optional, or wait for loop)
                  // Let's wait for next loop update to send first message
              }

              // 3. Move Idle Agents
              this.mockAgents.forEach(agent => {
                  if (agentsInConversation.has(agent.id)) return; // Don't move if chatting

                  if (Math.random() > 0.6) {
                      agent.state = 'moving';
                      const dir = Math.floor(Math.random() * 4);
                      let nextX = agent.gridX;
                      let nextY = agent.gridY;

                      if (dir === 0) nextX++;
                      else if (dir === 1) nextX--;
                      else if (dir === 2) nextY++;
                      else if (dir === 3) nextY--;

                      // Check collision
                      if (this.collisionManager?.canMoveTo(agent.gridX, agent.gridY, nextX, nextY)) {
                          agent.gridX = nextX;
                          agent.gridY = nextY;
                      } else {
                          // Blocked, stay idle
                          agent.state = 'idle';
                      }
                  } else {
                      agent.state = 'idle';
                  }
              });

              this.handleServerTick({ tick: tickCount, agents: [...this.mockAgents] });
          }
      });
  }

  private handleServerTick(update: WorldUpdate) {
    const currentIds = new Set<string>();

    update.agents.forEach((agentData) => {
      currentIds.add(agentData.id);
      this.agentsDataStore.set(agentData.id, agentData);

      let validGridX = agentData.gridX;
      let validGridY = agentData.gridY;

      // Validate position against collision map
      if (this.collisionManager && !this.collisionManager.isWalkable(validGridX, validGridY)) {
          // If position is blocked, try to stay at previous valid position
          const sprite = this.agents.get(agentData.id);
          if (sprite) {
              const prevGridX = Math.floor(sprite.x / TILE_SIZE);
              const prevGridY = Math.floor(sprite.y / TILE_SIZE);
              if (this.collisionManager.isWalkable(prevGridX, prevGridY)) {
                  validGridX = prevGridX;
                  validGridY = prevGridY;
                  // console.warn(`Agent ${agentData.id} blocked at ${agentData.gridX},${agentData.gridY}, staying at ${validGridX},${validGridY}`);
              }
          }
      }

      const targetX = validGridX * TILE_SIZE + (TILE_SIZE / 2);
      const targetY = validGridY * TILE_SIZE + (TILE_SIZE / 2);

      let sprite = this.agents.get(agentData.id);
      let nameTag = this.agentNameTags.get(agentData.id);

      if (!sprite) {
        // CREATE - Use CharacterRegistry for single-frame sprites
        const characterDef = this.getCharacterForAgent(agentData);
        
        // Create drop shadow for agent
        const shadow = this.add.graphics();
        shadow.fillStyle(0x000000, 0.3);
        shadow.fillEllipse(targetX, targetY + 20, 18, 8);
        shadow.setDepth(-1);
        this.agentShadows.set(agentData.id, shadow);
        
        // Check if the texture exists (for custom characters)
        let textureKey = characterDef.spriteKey;
        let frameIndex = characterDef.frameIndex;
        
        if (!this.textures.exists(textureKey)) {
          // Fallback to minions_atlas or fallback texture
          if (this.textures.exists('minions_atlas')) {
            textureKey = 'minions_atlas';
            frameIndex = 0;
          } else if (this.textures.exists('characters')) {
            textureKey = 'characters';
            frameIndex = 0;
          }
          console.warn(`Texture ${characterDef.spriteKey} not found, using fallback: ${textureKey}`);
        }
        
        sprite = this.add.sprite(targetX, targetY, textureKey, frameIndex);
        sprite.setInteractive();
        sprite.setData('id', agentData.id);
        
        // If using fallback texture, apply color tint
        if (textureKey === 'characters') {
          sprite.setTint(agentData.color || Math.random() * 0xffffff);
        }

        sprite.on('pointerdown', () => {
            const latestData = this.agentsDataStore.get(agentData.id);
            if (this.onAgentSelect && latestData) {
                this.onAgentSelect(latestData);
            }
        });

        this.agents.set(agentData.id, sprite);

        // Name Tag
        nameTag = this.add.text(targetX, targetY - 24, agentData.name || agentData.id.substring(0, 4), {
            fontSize: '10px',
            fontFamily: 'monospace',
            color: '#ffffff',
            backgroundColor: '#000000aa',
            padding: { x: 3, y: 1 }
        }).setOrigin(0.5);
        this.agentNameTags.set(agentData.id, nameTag!);

      } else {
        // UPDATE
        
        // 1. Move them across the map (Position Interpolation)
        this.tweens.add({
            targets: sprite,
            x: targetX,
            y: targetY,
            duration: TICK_DURATION,
            ease: 'Linear'
        });

        if (nameTag) {
            this.tweens.add({
                targets: nameTag,
                x: targetX,
                y: targetY - 24,
                duration: TICK_DURATION,
                ease: 'Linear'
            });
        }
        
        // Update shadow position
        const shadow = this.agentShadows.get(agentData.id);
        if (shadow) {
            this.tweens.add({
                targets: shadow,
                x: targetX - 9, // Center the ellipse (half width)
                y: targetY + 16, // Below sprite (half height)
                duration: TICK_DURATION,
                ease: 'Linear'
            });
        }
        
        // Note: Animation logic removed - using single-frame static sprites
        // Sprites maintain their fixed frame from CharacterRegistry
        // Position snapping for idle state
        if (agentData.state !== 'moving' && !this.tweens.isTweening(sprite)) {
            sprite.x = targetX;
            sprite.y = targetY;
        }
      }

      // Visual State updates
      if (agentData.state === 'chatting') {
         sprite.setAlpha(1);
         // Bounce effect for chatting
         if (!this.tweens.isTweening(sprite!)) {
             this.tweens.add({
                 targets: sprite,
                 y: targetY - 5,
                 duration: 200,
                 yoyo: true,
                 repeat: 1
             });
         }
      } else {
         sprite.setAlpha(1);
      }
    });

    // Cleanup
    this.agents.forEach((_, id) => {
        if (!currentIds.has(id)) {
            this.agents.get(id)?.destroy();
            this.agentNameTags.get(id)?.destroy();
            this.agentShadows.get(id)?.destroy();
            this.agents.delete(id);
            this.agentNameTags.delete(id);
            this.agentShadows.delete(id);
            this.agentsDataStore.delete(id);
        }
    });
  }

  update() {
    // Depth Sorting for Proper Layering (Y-Sorting for fake 3D)
    // Buildings and plants update dynamically based on their position
    // Agents are sorted by Y position for isometric-like depth
    
    for (const sprite of this.agents.values()) {
        // Agents: depth = y position (lower y = further back)
        // This allows agents to walk "behind" buildings/trees correctly
        sprite.setDepth(sprite.y);
        
        const id = sprite.getData('id');
        const tag = this.agentNameTags.get(id);
        const shadow = this.agentShadows.get(id);
        
        if (tag) {
            tag.setDepth(sprite.y + 1000); // Always floating above agents
        }
        
        if (shadow) {
            shadow.setDepth(sprite.y - 5); // Shadow below agent
        }
    }

    // Update environment depths
    if (this.environmentRenderer) {
      this.environmentRenderer.updateDepth();
    }

    // Keyboard Camera Controls
    const speed = 8;
    if (this.cursors) {
        if (this.cursors.left.isDown) this.cameras.main.scrollX -= speed;
        if (this.cursors.right.isDown) this.cameras.main.scrollX += speed;
        if (this.cursors.up.isDown) this.cameras.main.scrollY -= speed;
        if (this.cursors.down.isDown) this.cameras.main.scrollY += speed;
    }
  }


}
