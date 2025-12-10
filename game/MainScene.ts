
import Phaser from 'phaser';
import { io, Socket } from 'socket.io-client';
import { AgentData, SceneInitData, WorldUpdate, TILE_SIZE, TICK_DURATION, ChatMessage } from '../types';
import { JOB_SKINS, JobRole } from '../src/config/JobRegistry';
import { getCharacterByJob, getCharacterById, CHARACTER_REGISTRY, CharacterDefinition } from '../src/config/CharacterRegistry';
import { EnvironmentManager } from '../src/game/EnvironmentManager';
import { EnvironmentRenderer } from '../src/game/EnvironmentRenderer';
import { CollisionManager } from '../src/game/CollisionManager';

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
  }> = new Map();

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
    if (this.socket) {
        this.socket.disconnect();
        this.socket = null;
    }
    
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

  private setupSocket() {
    const url = 'http://localhost:3000';
    
    this.socket = io(url, {
      transports: ['websocket'],
      autoConnect: true,
      reconnectionAttempts: 3
    });

    this.socket.on('connect', () => {
      console.log('Connected to backend');
      this.useMockData = false; // Disable mock if real server connects
      if (this.mockTickTimer) this.mockTickTimer.remove();
      this.socket?.emit('join_world');
    });

    this.socket.on('server_tick', (update: WorldUpdate) => {
      this.handleServerTick(update);
    });
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
                  if (tickCount - state.lastUpdateTick >= 2) {
                      if (state.progress < state.script.messages.length) {
                          const msgDef = state.script.messages[state.progress];
                          const sender = msgDef.senderIndex === 0 ? initiator : partner;
                          const messageText = msgDef.text;

                          const chatMsg: ChatMessage = {
                              senderId: sender.id,
                              senderName: sender.name || sender.id,
                              text: messageText,
                              timestamp: Date.now()
                          };

                          // Push to BOTH agents' history
                          initiator.activeConversation?.push(chatMsg);
                          partner.activeConversation?.push(chatMsg);
                          
                          // Update last message for quick view
                          initiator.lastMessage = messageText;
                          partner.lastMessage = messageText;

                          state.progress++;
                          state.lastUpdateTick = tickCount;
                      } else {
                          // Conversation ended
                          this.activeConversations.delete(convId);
                          initiator.state = 'idle';
                          partner.state = 'idle';
                          initiator.conversationPartnerId = undefined;
                          partner.conversationPartnerId = undefined;
                          // Keep history for a while? Or clear it? 
                          // Let's keep it until next conversation starts
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
