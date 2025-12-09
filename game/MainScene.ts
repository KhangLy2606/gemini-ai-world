
import Phaser from 'phaser';
import { io, Socket } from 'socket.io-client';
import { AgentData, SceneInitData, WorldUpdate, TILE_SIZE, TICK_DURATION } from '../types';

export class MainScene extends Phaser.Scene {
  private socket: Socket | null = null;
  private agents: Map<string, Phaser.GameObjects.Sprite> = new Map();
  private agentNameTags: Map<string, Phaser.GameObjects.Text> = new Map();
  private onAgentSelect?: (agent: AgentData) => void;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  
  // Store latest data to handle click selection
  private agentsDataStore: Map<string, AgentData> = new Map();

  // Mock Simulation State
  private useMockData = true; // Set to true to see the world without a backend
  private mockTickTimer?: Phaser.Time.TimerEvent;

  constructor() {
    super({ key: 'MainScene' });
  }

  init(data: SceneInitData) {
    this.onAgentSelect = data.onAgentSelect;
  }

  preload() {
    // Load the character sprite sheet.
    // Ensure you place your image at /public/assets/characters.png
    // Assuming 32x32 frames based on typical pixel art styles. Adjust if your image is 16x16 or 24x24.
    this.load.spritesheet('characters', '/assets/characters.png', { 
      frameWidth: 26, // Estimated from typical sprite sheets like the one provided
      frameHeight: 36 // Estimated height
    });
    
    this.load.image('tileset', 'https://labs.phaser.io/assets/tilemaps/tiles/super-mario.png'); // Placeholder tiles
  }

  create() {
    this.events.on(Phaser.Scenes.Events.SHUTDOWN, this.shutdownScene, this);
    this.events.on(Phaser.Scenes.Events.DESTROY, this.shutdownScene, this);

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
    // Procedural Grid World Generation
    // We create a visual representation of a grid world
    const width = 40; // grid units
    const height = 30;
    
    // Draw Grass
    const graphics = this.add.graphics();
    
    for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
            const wx = x * TILE_SIZE;
            const wy = y * TILE_SIZE;
            
            // Checkerboard grass pattern
            const color = (x + y) % 2 === 0 ? 0x2d5a27 : 0x35682d;
            graphics.fillStyle(color, 1);
            graphics.fillRect(wx, wy, TILE_SIZE, TILE_SIZE);
            
            // Random decorations (simplified)
            if (Math.random() > 0.95) {
                graphics.fillStyle(0x1a3316, 0.5);
                graphics.fillCircle(wx + 16, wy + 16, 6);
            }
        }
    }
    
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
      console.log("Starting Mock Simulation...");
      const mockAgents: AgentData[] = [];
      const names = ["Neo", "Trinity", "Morpheus", "Smith", "Oracle", "Cypher", "Tank", "Dozer"];
      const messages = ["Looking for the One", "There is no spoon", "Follow the white rabbit", "Blue pill or Red pill?", "Processing...", "System failure"];

      // Initialize random agents
      for(let i=0; i<15; i++) {
          mockAgents.push({
              id: `mock-${i}`,
              gridX: Math.floor(Math.random() * 20) + 5,
              gridY: Math.floor(Math.random() * 15) + 5,
              state: 'idle',
              name: names[i % names.length],
              bio: `A simulated entity generated for world population. ID: ${i}`,
              characterId: i % 10, // Assign different sprite frames
              color: Math.random() * 0xffffff
          });
      }

      let tickCount = 0;

      this.mockTickTimer = this.time.addEvent({
          delay: TICK_DURATION,
          loop: true,
          callback: () => {
              tickCount++;
              // Randomly move agents
              mockAgents.forEach(agent => {
                  if (Math.random() > 0.6) {
                      agent.state = 'moving';
                      const dir = Math.floor(Math.random() * 4);
                      if (dir === 0) agent.gridX++;
                      else if (dir === 1) agent.gridX--;
                      else if (dir === 2) agent.gridY++;
                      else if (dir === 3) agent.gridY--;
                  } else if (Math.random() > 0.8) {
                      agent.state = 'chatting';
                      agent.lastMessage = messages[Math.floor(Math.random() * messages.length)];
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
        // Use 'characters' texture. Frame is characterId or default 0.
        // If using a sprite sheet, we can set the frame index.
        const frameIndex = agentData.characterId ?? 0;
        
        sprite = this.add.sprite(targetX, targetY, 'characters', frameIndex);
        sprite.setInteractive();
        sprite.setData('id', agentData.id);
        
        // Scale sprite to fit tile if necessary, or keep pixel art size
        // Assuming sprite sheet frames are reasonable size
        
        // If texture failed to load and we are using white box fallback, tint it
        if (!this.textures.exists('characters')) {
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
      }

      // Visual State updates
      if (agentData.state === 'chatting') {
         sprite.setAlpha(1);
         // Bounce effect
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
    // Depth Sorting
    for (const sprite of this.agents.values()) {
        sprite.setDepth(sprite.y);
        const id = sprite.getData('id');
        const tag = this.agentNameTags.get(id);
        if (tag) {
            tag.setDepth(sprite.y + 1000); // Always floating above
        }
    }

    // Keyboard Camera
    const speed = 8;
    if (this.cursors) {
        if (this.cursors.left.isDown) this.cameras.main.scrollX -= speed;
        if (this.cursors.right.isDown) this.cameras.main.scrollX += speed;
        if (this.cursors.up.isDown) this.cameras.main.scrollY -= speed;
        if (this.cursors.down.isDown) this.cameras.main.scrollY += speed;
    }
  }

  private shutdownScene() {
    if (this.mockTickTimer) this.mockTickTimer.remove();
    if (this.socket) {
        this.socket.disconnect();
        this.socket = null;
    }
  }
}
