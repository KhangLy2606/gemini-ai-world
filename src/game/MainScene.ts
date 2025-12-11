
import Phaser from 'phaser';
import { io, Socket } from 'socket.io-client';
import { 
  AgentData, 
  SceneInitData, 
  WorldUpdate, 
  TICK_DURATION, 
  TILE_SIZE,
  ChatMessage,
  ConversationStreamEventDetail
} from '@/types';
import { CHARACTER_REGISTRY } from '@/src/config/CharacterRegistry';
import { JOB_TO_CHARACTER_ID, JobRole } from '@/src/config/JobRegistry';
import { EnvironmentManager } from './EnvironmentManager';
import { EnvironmentRenderer } from './EnvironmentRenderer';
import { CollisionManager } from './CollisionManager';
import { ConversationDirector } from './ConversationDirector';

interface MainSceneData {
  onAgentSelect: (agent: AgentData) => void;
  onConversationUpdate: (detail: ConversationStreamEventDetail) => void;
}

export class MainScene extends Phaser.Scene {
  private agents: Map<string, AgentData> = new Map();
  private agentSprites: Map<string, Phaser.GameObjects.Sprite | Phaser.GameObjects.Container> = new Map();
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private socket: Socket | null = null;
  private onAgentSelect?: (agent: AgentData) => void;
  private onConversationUpdate?: (detail: ConversationStreamEventDetail) => void;
  
  // Systems
  private environmentManager!: EnvironmentManager;
  private environmentRenderer!: EnvironmentRenderer;
  private collisionManager!: CollisionManager;
  private conversationDirector!: ConversationDirector;
  
  // Map Dimensions
  private mapWidth: number = 0;
  private mapHeight: number = 0;

  // Map Dimensions
  private mapWidth: number = 0;
  private mapHeight: number = 0;

  // Mock Mode
  private isMockMode: boolean = true;
  private mockTickTimer?: Phaser.Time.TimerEvent;
  private mockAgents: AgentData[] = [];

  // Input State
  private isDragging: boolean = false;
  private dragStartX: number = 0;
  private dragStartY: number = 0;

  constructor() {
    super({ key: 'MainScene' });
  }

  init(data: MainSceneData) {
    this.onAgentSelect = data.onAgentSelect;
    this.onConversationUpdate = data.onConversationUpdate;
  }

  preload() {
    // Load character sprites from registry
    Object.values(CHARACTER_REGISTRY).forEach(char => {
       if (char.category === 'custom') {
           this.load.image(char.spriteKey, char.spritePath);
       } else {
           // Atlas loading (assuming atlas exists)
           // For MVP if atlas doesn't exist, we might want to load placeholder or use the generated assets
       }
    });

    // Load generated texture atlases if they exist
    // We assume these are placed in /assets/environment/
    this.load.image('grass_tileset', '/assets/environment/grass_tileset.png');
    this.load.image('path_tileset', '/assets/environment/path_tileset.png');
    
    // Fallback/Placeholder textures
    this.load.image('procedural_grid', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAALUlEQVRYR+3QQREAAAgCQfq3tsRjg48gwD25d0vAJwAAAAAAAAAAAAAAAADgBxMvA4G0p+qjAAAAAElFTkSuQmCC'); // 32x32 transparent
    
    // Load single image assets for buildings/props if available
    const buildings = [
        'OFFICE', 'HOSPITAL', 'CAFE', 'LIBRARY', 'LAB', 'WAREHOUSE', 'HOUSE', 'STORAGE',
        'CLOCK_TOWER', 'LECTURE_HALL', 'STUDENT_UNION', 'DORMITORY', 'STADIUM', 'SCIENCE_CENTER',
        'CAMPUS_GATE', 'STATUE', 'LAMPPOST', 'BIKE_RACK', 'BULLETIN_BOARD'
    ];
    buildings.forEach(b => this.load.image(`building-${b}`, `/assets/environment/building-${b.toLowerCase().replace(/_/g, '-')}.png`));
    
    // Load plant assets
    const plants = [
        'TREE_AUTUMN', 'TREE_MAPLE', 'HEDGE_TRIMMED', 'FLOWER_BED', 'IVY_WALL'
    ];
    plants.forEach(p => this.load.image(`plant-${p}`, `/assets/environment/plant-${p.toLowerCase().replace(/_/g, '-')}.png`));

    // If main atlas exists
    this.load.atlas('minions_atlas', '/assets/minions_atlas.png', '/assets/minions_atlas.json');
    this.load.atlas('buildings_atlas', '/assets/buildings_atlas.png', '/assets/buildings_atlas.json');
    this.load.atlas('plants_props_atlas', '/assets/plants_props_atlas.png', '/assets/plants_props_atlas.json');
    this.load.atlas('ui_atlas', '/assets/ui_atlas.png', '/assets/ui_atlas.json');
  }

  create() {
    // Enable Lighting System
    this.lights.enable();
    this.lights.setAmbientColor(0x808080); // Neutral ambient light

    // Initialize Systems
    // Calculate campus dimensions based on available screen area
    // Get the game's viewport dimensions and convert to tile dimensions
    const gameWidth = this.scale.width;
    const gameHeight = this.scale.height;
    
    // Calculate map dimensions in tiles to fill the available screen area
    // We add some padding (2x zoom factor) to ensure the map extends beyond the viewport
    const zoomFactor = 1.5; // Current default zoom
    this.mapWidth = Math.ceil((gameWidth * zoomFactor) / TILE_SIZE);
    this.mapHeight = Math.ceil((gameHeight * zoomFactor) / TILE_SIZE);
    
    this.environmentManager = new EnvironmentManager(this.mapWidth, this.mapHeight);
    const envData = this.environmentManager.generateEnvironment();
    
    this.environmentRenderer = new EnvironmentRenderer(this);
    this.environmentRenderer.render(this.mapWidth, this.mapHeight, envData.buildings, envData.plants);
    
    this.collisionManager = new CollisionManager(this.environmentManager);
    
    this.conversationDirector = new ConversationDirector(this, (detail) => {
        if (this.onConversationUpdate) this.onConversationUpdate(detail);
    });

    // Camera Setup
    this.cameras.main.setBounds(0, 0, this.mapWidth * TILE_SIZE, this.mapHeight * TILE_SIZE);
    this.cameras.main.setZoom(zoomFactor);
    this.cameras.main.centerOn(this.mapWidth * TILE_SIZE / 2, this.mapHeight * TILE_SIZE / 2);

    // Input: Keyboard & Zoom
    if (this.input.keyboard) {
        this.cursors = this.input.keyboard.createCursorKeys();
        
        // Zoom controls
        this.input.on('wheel', (pointer: Phaser.Input.Pointer, gameObjects: any, deltaX: number, deltaY: number, deltaZ: number) => {
            const zoom = this.cameras.main.zoom;
            const newZoom = Phaser.Math.Clamp(zoom - deltaY * 0.001, 0.5, 3);
            this.cameras.main.setZoom(newZoom);
        });
    }

    // Input: Mouse Interaction (Pan & Select)
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        this.isDragging = false;
        this.dragStartX = pointer.x;
        this.dragStartY = pointer.y;
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
        if (pointer.isDown) {
            // Drag logic
            this.cameras.main.scrollX -= (pointer.x - pointer.prevPosition.x) / this.cameras.main.zoom;
            this.cameras.main.scrollY -= (pointer.y - pointer.prevPosition.y) / this.cameras.main.zoom;
            
            // If moved significantly, consider it a drag (not a click)
            if (Phaser.Math.Distance.Between(pointer.x, pointer.y, this.dragStartX, this.dragStartY) > 5) {
                this.isDragging = true;
            }
        }
    });

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
        // Only select if it wasn't a drag operation
        if (!this.isDragging) {
            const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
            const gridX = Math.floor(worldPoint.x / TILE_SIZE);
            const gridY = Math.floor(worldPoint.y / TILE_SIZE);
            
            // Find agent at this position
            let clickedAgent: AgentData | null = null;
            for (const agent of this.agents.values()) {
                if (Math.round(agent.gridX) === gridX && Math.round(agent.gridY) === gridY) {
                    clickedAgent = agent;
                    break;
                }
            }

            if (clickedAgent && this.onAgentSelect) {
                this.onAgentSelect(clickedAgent);
            }
        }
    });

    // Socket Connection
    // Check if we are in dev mode (localhost) or prod
    const serverUrl = window.location.hostname === 'localhost' ? 'http://localhost:3001' : '/';
    try {
        this.socket = io(serverUrl, { 
            autoConnect: true,
            reconnection: true,
            reconnectionAttempts: 3, // Limit attempts to prevent log spam in frontend-only mode
            timeout: 5000,
        });

        this.socket.on('connect', () => {
            console.log('Connected to game server');
            this.isMockMode = false;
            this.conversationDirector.setSocket(this.socket);
            if (this.mockTickTimer) this.mockTickTimer.remove();
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from game server, switching to mock mode');
            this.startMockSimulation();
        });

        this.socket.on('server_tick', (update: WorldUpdate) => {
            this.handleServerTick(update);
        });

        // Error handling
        this.socket.on('connect_error', (err) => {
            // Only log if we haven't already switched to mock mode to reduce noise
            if (!this.isMockMode) {
                console.warn('Socket connection error (using mock mode):', err.message);
                this.startMockSimulation();
            }
        });

    } catch (e) {
        console.warn('Failed to initialize socket, using mock mode');
        this.startMockSimulation();
    }
    
    this.conversationDirector.setSocket(this.socket);

    // Initial Mock Start if no immediate connection
    if (!this.socket?.connected) {
        this.startMockSimulation();
    }

    // Handle events from React
    window.addEventListener('create-agent', this.handleCreateAgent as EventListener);
    window.addEventListener('start-chat', this.handleStartChat as EventListener);

    this.events.on('shutdown', () => {
        window.removeEventListener('create-agent', this.handleCreateAgent as EventListener);
        window.removeEventListener('start-chat', this.handleStartChat as EventListener);
        if (this.socket) this.socket.disconnect();
        if (this.environmentRenderer) this.environmentRenderer.destroy();
    });
  }

  update(time: number, delta: number) {
    // Camera movement via Keyboard (WASD/Arrows)
    const cameraSpeed = 10; // Pixels per frame
    if (this.cursors) {
        if (this.cursors.left.isDown) this.cameras.main.scrollX -= cameraSpeed;
        else if (this.cursors.right.isDown) this.cameras.main.scrollX += cameraSpeed;

        if (this.cursors.up.isDown) this.cameras.main.scrollY -= cameraSpeed;
        else if (this.cursors.down.isDown) this.cameras.main.scrollY += cameraSpeed;
    }

    // Interpolate agent positions
    this.agentSprites.forEach((sprite, id) => {
        const agent = this.agents.get(id);
        if (agent) {
            const targetX = agent.gridX * TILE_SIZE;
            const targetY = agent.gridY * TILE_SIZE;
            
            // Simple LERP
            sprite.x += (targetX - sprite.x) * 0.1;
            sprite.y += (targetY - sprite.y) * 0.1;
            
            // Depth sorting based on Y
            sprite.setDepth(sprite.y + 16);
        }
    });

    // Update Director
    this.conversationDirector.update(time, delta, this.agents);
  }

  // --- Handlers ---

  private handleServerTick(update: WorldUpdate) {
      // Update internal state
      const seenIds = new Set<string>();
      
      update.agents.forEach(agentData => {
          seenIds.add(agentData.id);
          const existing = this.agents.get(agentData.id);
          
          if (existing) {
              // Merge data
              Object.assign(existing, agentData);
          } else {
              // New agent
              this.agents.set(agentData.id, agentData);
              this.createAgentSprite(agentData);
          }
      });

      // Remove stale agents
      this.agents.forEach((agent, id) => {
          if (!seenIds.has(id)) {
              this.agents.delete(id);
              const sprite = this.agentSprites.get(id);
              if (sprite) {
                  sprite.destroy();
                  this.agentSprites.delete(id);
              }
          }
      });
  }

  private createAgentSprite(agent: AgentData) {
      // Container for agent + extras (name tag, bubbles)
      const container = this.add.container(agent.gridX * TILE_SIZE, agent.gridY * TILE_SIZE);
      
      // Determine Texture
      let textureKey = 'minions_atlas'; // Default
      let frameIndex = 0;
      let isCustom = false;

      // Check Character Registry
      if (agent.spriteKey && CHARACTER_REGISTRY[agent.spriteKey]) {
          const char = CHARACTER_REGISTRY[agent.spriteKey];
          textureKey = char.spriteKey;
          frameIndex = char.frameIndex;
          if (char.category === 'custom') isCustom = true;
      } else if (agent.job) {
           // Legacy Fallback
           const legacyJob = agent.job as JobRole;
           if (JOB_TO_CHARACTER_ID[legacyJob]) {
               const charId = JOB_TO_CHARACTER_ID[legacyJob];
               const char = CHARACTER_REGISTRY[charId];
               textureKey = char.spriteKey;
               frameIndex = char.frameIndex;
           }
      }

      let sprite: Phaser.GameObjects.Sprite;
      
      if (isCustom && this.textures.exists(textureKey)) {
          // Custom single image
          sprite = this.add.sprite(0, 0, textureKey);
          sprite.setDisplaySize(32, 32);
      } else if (this.textures.exists(textureKey)) {
          // Atlas
          sprite = this.add.sprite(0, 0, textureKey, frameIndex);
      } else {
          // Fallback circle
          const graphics = this.add.graphics();
          graphics.fillStyle(agent.color || 0x00ff00, 1);
          graphics.fillCircle(16, 16, 14);
          container.add(graphics);
          
          // Dummy sprite for API consistency
          sprite = this.add.sprite(0, 0, 'dummy'); 
          sprite.setVisible(false);
      }
      
      sprite.setOrigin(0.5, 0.5);
      container.x += TILE_SIZE / 2;
      container.y += TILE_SIZE / 2;
      
      // Enable lighting on agent
      // sprite.setPipeline('Light2D');
      
      container.add(sprite);
      
      // Name Tag
      const nameText = this.add.text(0, -24, agent.name || agent.id.substring(0, 4), {
          fontSize: '10px',
          color: '#ffffff',
          backgroundColor: '#00000080',
          padding: { x: 2, y: 1 }
      });
      nameText.setOrigin(0.5);
      container.add(nameText);

      this.agentSprites.set(agent.id, container);
  }

  // --- Mock Simulation ---

  private startMockSimulation() {
      if (this.isMockMode && this.mockTickTimer) return; // Already running
      
      console.log('Starting Mock Simulation...');
      this.isMockMode = true;
      
      // Seed some mock agents
      const mockDefinitions = [
          { job: 'TECH_HACKER', name: 'Alex', bio: 'Computer Science Student. Lives in the terminal.' },
          { job: 'HEALTH_DOC_MALE', name: 'Ben', bio: 'Natural Science Student. Studying local flora.' },
          { job: 'TECH_DEV_MALE', name: 'Charlie', bio: 'Business Student. Analyzing market trends.' },
          { job: 'HEALTH_NURSE_FEMALE', name: 'Dana', bio: 'Health Care Student. Practicing patient care.' },
          { job: 'EDU_PROFESSOR', name: 'Eddie', bio: 'Math Student. Solving complex equations.' }
      ];
      
      mockDefinitions.forEach((def, i) => {
          const id = `mock-${i}`;
          // Don't overwrite if exists
          if (!this.agents.has(id)) {
            const agent: AgentData = {
                id: id,
                name: def.name,
                bio: def.bio,
                job: def.job as JobRole, // This cast is valid if JobRole matches the string in definition
                gridX: Math.floor(Math.random() * Math.max(1, this.mapWidth - 10)) + 5,
                gridY: Math.floor(Math.random() * Math.max(1, this.mapHeight - 10)) + 5,
                state: 'idle',
                color: Math.random() * 0xffffff,
                activeConversation: []
            };
            this.agents.set(id, agent);
            this.createAgentSprite(agent);
            this.mockAgents.push(agent);
          }
      });

      // Start tick loop
      this.mockTickTimer = this.time.addEvent({
          delay: TICK_DURATION,
          loop: true,
          callback: () => this.runMockTick()
      });
  }

  private runMockTick() {
      if (!this.isMockMode) return;

      // Move agents randomly
      this.mockAgents.forEach(agent => {
          if (agent.state === 'idle') {
              if (Math.random() > 0.7) {
                  const moves = [[0, 1], [0, -1], [1, 0], [-1, 0]];
                  const move = moves[Math.floor(Math.random() * moves.length)];
                  const newX = agent.gridX + move[0];
                  const newY = agent.gridY + move[1];
                  
                  if (this.collisionManager.isWalkable(newX, newY)) {
                      agent.gridX = newX;
                      agent.gridY = newY;
                      agent.state = 'moving';
                      // Reset to idle after short delay (simulated via next tick probability)
                  }
              }
          } else if (agent.state === 'moving') {
               if (Math.random() > 0.5) agent.state = 'idle';
          }
      });
  }
  
  // --- Event Handlers ---
  
  private handleCreateAgent = (event: CustomEvent<Partial<AgentData>>) => {
      const data = event.detail;
      const id = `user-${Date.now()}`;
      const newAgent: AgentData = {
          id,
          name: data.name || 'New Agent',
          bio: data.bio,
          job: data.job,
          spriteKey: data.spriteKey,
          gridX: data.gridX || 10,
          gridY: data.gridY || 10,
          state: 'idle',
          activeConversation: [],
          ...data
      } as AgentData;
      
      // If there is custom texture data
      if ((data as any).textureData) {
          const texKey = data.spriteKey || `gen_${Date.now()}`;
          // Load texture into Phaser
          this.textures.addBase64(texKey, (data as any).textureData);
          newAgent.spriteKey = texKey;
      }
      
      if (this.isMockMode) {
          this.agents.set(id, newAgent);
          this.createAgentSprite(newAgent);
          this.mockAgents.push(newAgent);
          
          // Select it
          if (this.onAgentSelect) this.onAgentSelect(newAgent);
      } else {
          // Emit to server
          this.socket?.emit('agent:create', newAgent);
      }
  }
  
  private handleStartChat = (event: CustomEvent<{agentId: string}>) => {
      const { agentId } = event.detail;
      const agent = this.agents.get(agentId);
      if (!agent) return;
      
      // Find nearest neighbor
      let nearest: AgentData | null = null;
      let minDist = Infinity;
      
      this.agents.forEach(other => {
          if (other.id !== agent.id) {
              const dist = Phaser.Math.Distance.Between(agent.gridX, agent.gridY, other.gridX, other.gridY);
              if (dist < minDist && dist < 5) { // Must be close
                  minDist = dist;
                  nearest = other;
              }
          }
      });
      
      if (nearest) {
          this.conversationDirector.startConversation(agent, nearest);
      } else {
          console.log("No agent nearby to chat with.");
      }
  }
}
