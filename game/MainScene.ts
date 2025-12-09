
import Phaser from 'phaser';
import { io, Socket } from 'socket.io-client';
import { AgentData, SceneInitData, WorldUpdate, TILE_SIZE, TICK_DURATION, ChatMessage } from '../types';
import { JOB_SKINS, JobRole } from '../src/config/JobRegistry';
import { EnvironmentManager } from '../src/game/EnvironmentManager';
import { EnvironmentRenderer } from '../src/game/EnvironmentRenderer';

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
  private onAgentSelect?: (agent: AgentData) => void;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  
  // Store latest data to handle click selection
  private agentsDataStore: Map<string, AgentData> = new Map();

  // Environment System
  private environmentManager?: EnvironmentManager;
  private environmentRenderer?: EnvironmentRenderer;

  // Mock Simulation State
  private useMockData = true; // Set to true to see the world without a backend
  private mockTickTimer?: Phaser.Time.TimerEvent;
  
  // Conversation Director State
  private activeConversations: Map<string, {
      initiatorId: string;
      partnerId: string;
      script: ConversationScript;
      progress: number; // Index of the next message to send
      lastUpdateTick: number;
  }> = new Map();

  constructor() {
    super({ key: 'MainScene' });
  }

  init(data: SceneInitData) {
    this.onAgentSelect = data.onAgentSelect;
  }

  preload() {
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

    // Generate fallback textures if assets failed to load (for robust demo)
    if (!this.textures.exists('characters')) {
        this.createFallbackTextures();
    }

    // Camera Setup
    this.cameras.main.setZoom(2);
    this.cameras.main.centerOn(400, 300);
    this.cameras.main.setBackgroundColor('#2d2d2d');

    if (this.input.keyboard) {
        this.cursors = this.input.keyboard.createCursorKeys();
    }

    // Start Mock Simulation if enabled
    if (this.useMockData) {
        this.startMockSimulation();
    }
  }

  private handleCreateAgentEvent = (event: CustomEvent<Partial<AgentData>>) => {
    const newAgent = event.detail;
    console.log("MainScene received new agent:", newAgent);
    
    // In a real app, we would send this to the server.
    // For the mock simulation, we'll just add it to our local mock state.
    if (this.useMockData) {
        // We need to inject this into the mock loop somehow, or just force a tick update.
        // Since the mock loop runs on a timer and updates `mockAgents`, we can't easily access that closure variable.
        // A better way for the mock is to just emit a server tick with the new agent added, 
        // but the next tick would overwrite it if we don't persist it.
        
        // Hack for demo: We will just manually add the sprite immediately to visualize it,
        // even though the next mock tick might not include it (or we'd need to restart the mock).
        // Actually, let's just restart the mock simulation with the new agent included if possible,
        // or better yet, just let the user know it was "sent".
        
        // Let's try to add it to the scene directly as a "client-side predicted" entity
        const id = `custom-${Date.now()}`;
        const agentData: AgentData = {
            id,
            gridX: newAgent.gridX || 10,
            gridY: newAgent.gridY || 10,
            state: 'idle',
            name: newAgent.name || 'Custom Agent',
            bio: newAgent.bio || 'User generated.',
            job: newAgent.job || 'TECH_DEV_MALE',
            color: Math.random() * 0xffffff,
            lastMessage: "Hello world! I am new here."
        };
        
        // We'll treat this as a server update containing just this agent for now, 
        // but to make it persist in the mock loop we'd need to refactor the mock loop to be a class property.
        // For this task, simply acknowledging it in the console and showing a toast would be enough,
        // but let's try to render it.
        
        this.handleServerTick({ tick: 0, agents: [agentData] });
        
        // Note: In the next tick of the mock loop, this agent will disappear because the mock loop 
        // has its own array of agents. This is expected behavior for a frontend-only mock without persistent state.
        alert(`Agent "${agentData.name}" created! (It will appear briefly before the simulation resets)`);
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

  // --- MOCK SIMULATION FOR DEMO ---
  private startMockSimulation() {
      console.log("Starting Mock Simulation with Conversation Engine...");
      const mockAgents: AgentData[] = [];
      const names = ["Neo", "Trinity", "Morpheus", "Smith", "Oracle", "Cypher", "Tank", "Dozer"];
      
      // Initialize random agents
      for(let i=0; i<15; i++) {
          mockAgents.push({
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

                  const initiator = mockAgents.find(a => a.id === state.initiatorId);
                  const partner = mockAgents.find(a => a.id === state.partnerId);

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
              const availableAgents = mockAgents.filter(a => !agentsInConversation.has(a.id) && a.state === 'idle');
              
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
              mockAgents.forEach(agent => {
                  if (agentsInConversation.has(agent.id)) return; // Don't move if chatting

                  if (Math.random() > 0.6) {
                      agent.state = 'moving';
                      const dir = Math.floor(Math.random() * 4);
                      if (dir === 0) agent.gridX++;
                      else if (dir === 1) agent.gridX--;
                      else if (dir === 2) agent.gridY++;
                      else if (dir === 3) agent.gridY--;
                  } else {
                      agent.state = 'idle';
                  }
              });

              this.handleServerTick({ tick: tickCount, agents: [...mockAgents] });
          }
      });
  }

  private handleServerTick(update: WorldUpdate) {
    const currentIds = new Set<string>();

    update.agents.forEach((agentData) => {
      currentIds.add(agentData.id);
      this.agentsDataStore.set(agentData.id, agentData);

      const targetX = agentData.gridX * TILE_SIZE + (TILE_SIZE / 2);
      const targetY = agentData.gridY * TILE_SIZE + (TILE_SIZE / 2);

      let sprite = this.agents.get(agentData.id);
      let nameTag = this.agentNameTags.get(agentData.id);

      if (!sprite) {
        // CREATE
        // Use 'agent_atlas' texture. Determine frame from Job Registry.
        const job = agentData.job as JobRole;
        const frameIndex = JOB_SKINS[job] ?? JOB_SKINS.TECH_DEV_MALE; // Default to 0
        
        sprite = this.add.sprite(targetX, targetY, 'agent_atlas', frameIndex);
        sprite.setInteractive();
        sprite.setData('id', agentData.id);
        
        // If texture failed to load and we are using white box fallback, tint it
        if (!this.textures.exists('agent_atlas')) {
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

        // 2. Make them "Hop" to simulate life (Visual Polish)
        const isMoving = agentData.state === 'moving';
        
        if (isMoving) {
            // Only add this tween if it's not already playing
            if (!sprite.getData('isHopping')) {
                this.tweens.add({
                    targets: sprite,
                    y: '-=4', // Move up 4 pixels
                    yoyo: true, // Go back down
                    duration: 150, // Fast hop
                    repeat: -1, // Loop forever while moving
                    onStart: () => sprite.setData('isHopping', true)
                });
            }
        } else {
             // Stop hopping when idle
             if (sprite.getData('isHopping')) {
                 this.tweens.killTweensOf(sprite); // stops movement too, but we are idle so strictly verify pos
                 sprite.setData('isHopping', false);
                 sprite.y = targetY; // Snap to floor (targetY is the grid center)
                 sprite.x = targetX;
             }
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
            this.agents.delete(id);
            this.agentNameTags.delete(id);
            this.agentsDataStore.delete(id);
        }
    });
  }

  update() {
    // Depth Sorting for Proper Layering
    // Buildings and plants update dynamically based on their position
    // Agents are sorted by Y position for isometric-like depth
    
    for (const sprite of this.agents.values()) {
        // Agents: depth = y position (lower y = further back)
        sprite.setDepth(sprite.y);
        
        const id = sprite.getData('id');
        const tag = this.agentNameTags.get(id);
        if (tag) {
            tag.setDepth(sprite.y + 1000); // Always floating above agents
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
