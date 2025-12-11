
// Environment Renderer
// Handles the visual representation of the environment
// Decouples rendering logic from the MainScene

import Phaser from 'phaser';
import { BuildingObject, PlantObject, TILE_SIZE } from '../../types';
import { WorldDecorator } from './WorldDecorator';
import { AutoTiler } from './AutoTiler';
import { BuildingType } from '../config/EnvironmentRegistry';

export class EnvironmentRenderer {
  private scene: Phaser.Scene;
  private buildingsGroup: Map<string, Phaser.GameObjects.Sprite | Phaser.GameObjects.Graphics> = new Map();
  private plantsGroup: Map<string, Phaser.GameObjects.Sprite | Phaser.GameObjects.Graphics> = new Map();
  private decorator: WorldDecorator;

  constructor(scene: Phaser.Scene, seed: number = 12345) {
    this.scene = scene;
    this.decorator = new WorldDecorator(scene, seed);
  }

  public render(
    width: number,
    height: number,
    buildings: BuildingObject[],
    plants: PlantObject[]
  ): void {
    // 1. Base Terrain
    this.renderTerrain(width, height);

    // 2. Decorators
    this.decorator.addTerrainVariation(width, height);
    this.decorator.addAtmospherics(width, height);
    this.decorator.addWaterFeatures(width, height);
    
    const buildingRects = buildings.map(b => ({ 
      gridX: b.gridX, gridY: b.gridY, w: b.width, h: b.height 
    }));
    this.decorator.addPathways(width, height, buildingRects);
    this.decorator.addDecorations(width, height, 0.08);

    // 3. Buildings
    buildings.forEach(building => this.renderBuilding(building));

    // 4. Shadows
    const plantRects = plants.map(p => ({
      gridX: p.gridX, gridY: p.gridY, width: p.width, height: p.height
    }));
    const buildingShadowRects = buildings.map(b => ({
      gridX: b.gridX, gridY: b.gridY, width: b.width, height: b.height
    }));
    this.decorator.addShadows(buildingShadowRects, plantRects);

    // 5. Plants
    plants.forEach(plant => this.renderPlant(plant));

    // 6. HUD Elements
    this.decorator.addCompass(80, 80);
  }

  public updateDepth(): void {
    this.buildingsGroup.forEach(building => {
      const currentDepth = building.depth;
      const minDepth = 10;
      if (currentDepth < minDepth) building.setDepth(minDepth);
    });

    this.plantsGroup.forEach(plant => {
      const currentDepth = plant.depth;
      const minDepth = 20;
      if (currentDepth < minDepth) plant.setDepth(minDepth);
    });
  }

  public destroy(): void {
    this.buildingsGroup.forEach(g => g.destroy());
    this.plantsGroup.forEach(g => g.destroy());
    this.buildingsGroup.clear();
    this.plantsGroup.clear();
    this.decorator.destroy();
  }

  private addDropShadow(x: number, y: number, width: number, height: number): void {
    const shadowGraphics = this.scene.add.graphics();
    shadowGraphics.setDepth(-5);
    
    const shadowCenterX = x + (width / 2);
    const shadowCenterY = y + height + 4;
    const shadowRadiusX = width * 0.4;
    const shadowRadiusY = height * 0.15;
    
    shadowGraphics.fillStyle(0x000000, 0.3);
    shadowGraphics.fillEllipse(shadowCenterX, shadowCenterY, shadowRadiusX, shadowRadiusY);
  }

  private renderTerrain(width: number, height: number): void {
    const tileWidth = 32;
    const tileHeight = 32;

    // Use generated procedural grid if real tileset is missing
    if (this.scene.textures.exists('grass_tileset')) {
        const map = this.scene.make.tilemap({ tileWidth, tileHeight, width, height });
        const tileset = map.addTilesetImage('grass_tileset', 'grass_tileset', 32, 32);
        
        if (tileset) {
            const layer = map.createBlankLayer('terrain', tileset, 0, 0, width, height);
            if (layer) {
                // If it's the generated 2x3 atlas, we map tiles simply
                // The generated atlas has 6 large tiles, we probably just want tile index 0 repeating for now
                // Or implementing autotiling if the atlas supported it.
                // For this demo, we'll fill with index 0
                layer.fill(0);
                layer.setDepth(-100);
            }
        }
    } else {
        // Fallback: TiledSprite with generated texture
        if (this.scene.textures.exists('procedural_grid')) {
            const tiledSprite = this.scene.add.tileSprite(0, 0, width * tileWidth, height * tileHeight, 'procedural_grid');
            tiledSprite.setOrigin(0, 0);
            tiledSprite.setDepth(-100);
        } else {
            // Ultimate fallback
            const grassGraphics = this.scene.add.graphics();
            grassGraphics.setDepth(-100);
            for (let x = 0; x < width; x++) {
                for (let y = 0; y < height; y++) {
                    const wx = x * TILE_SIZE;
                    const wy = y * TILE_SIZE;
                    const color = (x + y) % 2 === 0 ? 0x2d5a27 : 0x35682d;
                    grassGraphics.fillStyle(color, 1);
                    grassGraphics.fillRect(wx, wy, TILE_SIZE, TILE_SIZE);
                }
            }
        }
    }
  }

  private renderBuilding(building: BuildingObject): void {
    const x = building.gridX * TILE_SIZE;
    const y = building.gridY * TILE_SIZE;
    
    // 1. Try Specific Generated Asset first (e.g., 'building-OFFICE')
    const specificKey = `building-${building.buildingType}`;
    
    if (this.scene.textures.exists(specificKey)) {
        this.addDropShadow(x, y, building.width * TILE_SIZE, building.height * TILE_SIZE);
        const sprite = this.scene.add.sprite(x, y, specificKey);
        sprite.setOrigin(0, 0);
        sprite.setDisplaySize(building.width * TILE_SIZE, building.height * TILE_SIZE);
        sprite.setDepth(y + building.height * TILE_SIZE);
        this.buildingsGroup.set(building.id, sprite);
        return;
    }

    // 2. Try Atlas
    if (this.scene.textures.exists('buildings_atlas')) {
        this.addDropShadow(x, y, building.width * TILE_SIZE, building.height * TILE_SIZE);
        
        let frameIndex = 0;
        if (building.buildingType.includes('TECH') || building.buildingType === BuildingType.OFFICE) frameIndex = 0;
        else if (building.buildingType.includes('HOSPITAL')) frameIndex = 1;
        else if (building.buildingType.includes('CAFE')) frameIndex = 2;
        else if (building.buildingType.includes('LIBRARY')) frameIndex = 3;
        else if (building.buildingType.includes('LAB')) frameIndex = 4;
        else if (building.buildingType === BuildingType.WAREHOUSE) frameIndex = 5; // Assuming index

        const sprite = this.scene.add.sprite(x, y, 'buildings_atlas', frameIndex);
        sprite.setOrigin(0, 0);
        sprite.setDisplaySize(building.width * TILE_SIZE, building.height * TILE_SIZE);
        sprite.setDepth(y + building.height * TILE_SIZE);
        this.buildingsGroup.set(building.id, sprite);
        return;
    } 

    // 3. Fallback to Enhanced Procedural Graphics
    const graphics = this.scene.add.graphics();
    const width = building.width * TILE_SIZE;
    const height = building.height * TILE_SIZE;

    this.addDropShadow(x, y, width, height);
    
    // Render based on building type for unique campus architecture
    switch (building.buildingType) {
      case BuildingType.CLOCK_TOWER:
        this.renderClockTower(graphics, x, y, width, height, building);
        break;
      case BuildingType.LECTURE_HALL:
      case BuildingType.LIBRARY:
        this.renderGothicBuilding(graphics, x, y, width, height, building);
        break;
      case BuildingType.DORMITORY:
        this.renderBrickBuilding(graphics, x, y, width, height, building);
        break;
      case BuildingType.SCIENCE_CENTER:
      case BuildingType.LAB:
        this.renderModernBuilding(graphics, x, y, width, height, building);
        break;
      case BuildingType.STADIUM:
        this.renderStadium(graphics, x, y, width, height, building);
        break;
      case BuildingType.STATUE:
        this.renderStatue(graphics, x, y, width, height);
        break;
      case BuildingType.LAMPPOST:
        this.renderLamppost(graphics, x, y);
        break;
      case BuildingType.FOUNTAIN:
        this.renderFountain(graphics, x, y, width, height);
        break;
      case BuildingType.CAMPUS_GATE:
        this.renderCampusGate(graphics, x, y, width, height);
        break;
      default:
        this.renderDefaultBuilding(graphics, x, y, width, height, building);
    }

    graphics.setDepth(y + height);
    this.buildingsGroup.set(building.id, graphics);
  }
  
  // ========== Specialized Campus Building Renderers ==========
  
  private renderClockTower(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, building: BuildingObject): void {
    // Base tower (stone)
    g.fillStyle(0xD4C4A8, 1);
    g.fillRect(x + w*0.15, y + h*0.3, w*0.7, h*0.7);
    
    // Spire (pointed roof)
    g.fillStyle(0x708090, 1);
    g.fillTriangle(x + w/2, y, x + w*0.2, y + h*0.35, x + w*0.8, y + h*0.35);
    
    // Clock face
    g.fillStyle(0xFFFFF0, 1);
    g.fillCircle(x + w/2, y + h*0.5, w*0.2);
    g.lineStyle(2, 0x333333, 1);
    g.strokeCircle(x + w/2, y + h*0.5, w*0.2);
    // Clock hands
    g.lineStyle(2, 0x333333, 1);
    g.lineBetween(x + w/2, y + h*0.5, x + w/2, y + h*0.38);
    g.lineBetween(x + w/2, y + h*0.5, x + w*0.6, y + h*0.5);
    
    // Arched windows
    g.fillStyle(0x333333, 0.8);
    for(let i = 0; i < 3; i++) {
      const wy = y + h*0.6 + i*20;
      g.fillRect(x + w*0.35, wy, 8, 12);
      g.fillRect(x + w*0.55, wy, 8, 12);
    }
    
    // Door
    g.fillStyle(0x8B4513, 1);
    g.fillRect(x + w/2 - 8, y + h - 20, 16, 20);
  }
  
  private renderGothicBuilding(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, building: BuildingObject): void {
    // Main body (stone)
    g.fillStyle(building.color, 1);
    g.fillRect(x, y + h*0.2, w, h*0.8);
    
    // Gothic pointed roof
    g.fillStyle(building.secondaryColor || 0x708090, 1);
    g.fillTriangle(x + w/2, y, x - 5, y + h*0.25, x + w + 5, y + h*0.25);
    
    // Buttresses (vertical pillars on sides)
    g.fillStyle(0x8B7355, 1);
    g.fillRect(x - 3, y + h*0.3, 6, h*0.7);
    g.fillRect(x + w - 3, y + h*0.3, 6, h*0.7);
    
    // Pointed arch windows
    g.fillStyle(0xFFEB3B, 0.7);
    const windowCount = Math.floor(w / 25);
    for(let i = 0; i < windowCount; i++) {
      const wx = x + 15 + i * 25;
      // Draw pointed arch window
      g.fillRect(wx, y + h*0.4, 10, 20);
      g.fillTriangle(wx + 5, y + h*0.35, wx, y + h*0.4, wx + 10, y + h*0.4);
    }
    
    // Second row of windows
    for(let i = 0; i < windowCount; i++) {
      const wx = x + 15 + i * 25;
      g.fillRect(wx, y + h*0.65, 10, 15);
    }
    
    // Grand entrance
    g.fillStyle(0x8B4513, 1);
    g.fillRect(x + w/2 - 12, y + h - 25, 24, 25);
    g.fillStyle(0x333333, 1);
    g.fillTriangle(x + w/2, y + h - 35, x + w/2 - 14, y + h - 25, x + w/2 + 14, y + h - 25);
  }
  
  private renderBrickBuilding(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, building: BuildingObject): void {
    // Main body (brick)
    g.fillStyle(building.color, 1);
    g.fillRect(x, y, w, h);
    
    // Brick pattern overlay
    g.lineStyle(1, 0xD2B48C, 0.3);
    for(let by = y + 4; by < y + h - 10; by += 6) {
      for(let bx = x; bx < x + w; bx += 12) {
        const offset = (Math.floor((by - y) / 6) % 2) * 6;
        g.strokeRect(bx + offset, by, 10, 4);
      }
    }
    
    // Slate roof
    g.fillStyle(building.secondaryColor || 0x708090, 1);
    g.fillRect(x - 2, y - 5, w + 4, 12);
    
    // Windows (dorm-style: rows of identical windows)
    g.fillStyle(0xFFEB3B, 0.6);
    for(let row = 0; row < 4; row++) {
      for(let col = 0; col < Math.floor(w / 20); col++) {
        const wx = x + 8 + col * 20;
        const wy = y + 15 + row * 25;
        if (wy + 12 < y + h - 20) {
          g.fillRect(wx, wy, 10, 12);
        }
      }
    }
    
    // Entry door
    g.fillStyle(0x333333, 1);
    g.fillRect(x + w/2 - 10, y + h - 22, 20, 22);
  }
  
  private renderModernBuilding(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, building: BuildingObject): void {
    // Glass facade
    g.fillStyle(building.color, 1);
    g.fillRect(x, y, w, h);
    
    // Reflective glass panels
    g.fillStyle(0x87CEEB, 0.4);
    for(let col = 0; col < Math.floor(w / 18); col++) {
      g.fillRect(x + 2 + col * 18, y + 5, 16, h - 15);
    }
    
    // Steel frame lines
    g.lineStyle(2, 0x4682B4, 0.8);
    for(let lx = x; lx <= x + w; lx += 18) {
      g.lineBetween(lx, y, lx, y + h);
    }
    for(let ly = y; ly <= y + h; ly += 20) {
      g.lineBetween(x, ly, x + w, ly);
    }
    
    // Entry (glass doors)
    g.fillStyle(0x4682B4, 0.8);
    g.fillRect(x + w/2 - 15, y + h - 25, 30, 25);
  }
  
  private renderStadium(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, building: BuildingObject): void {
    // Stadium base/field (green)
    g.fillStyle(0x228B22, 1);
    g.fillRect(x + w*0.1, y + h*0.3, w*0.8, h*0.5);
    
    // Stands (tiered seating)
    g.fillStyle(0x708090, 1);
    // North stands
    g.fillRect(x, y, w, h*0.25);
    // South stands
    g.fillRect(x, y + h*0.85, w, h*0.15);
    // East/West stands
    g.fillRect(x, y, w*0.1, h);
    g.fillRect(x + w*0.9, y, w*0.1, h);
    
    // Seat rows
    g.fillStyle(0xDC143C, 0.7);
    for(let row = 0; row < 3; row++) {
      g.fillRect(x + 5, y + 5 + row*8, w - 10, 6);
    }
    
    // Field markings
    g.lineStyle(2, 0xFFFFFF, 0.8);
    g.strokeRect(x + w*0.15, y + h*0.35, w*0.7, h*0.4);
    g.strokeCircle(x + w/2, y + h*0.55, 15);
  }
  
  private renderStatue(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number): void {
    // Pedestal
    g.fillStyle(0x708090, 1);
    g.fillRect(x + 4, y + h*0.6, w - 8, h*0.4);
    
    // Statue figure (simplified)
    g.fillStyle(0x8B7355, 1);
    g.fillCircle(x + w/2, y + h*0.35, 6);
    g.fillRect(x + w/2 - 4, y + h*0.4, 8, h*0.25);
  }
  
  private renderLamppost(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
    // Post
    g.fillStyle(0x2F4F4F, 1);
    g.fillRect(x + 14, y + 8, 4, 24);
    
    // Lamp head
    g.fillStyle(0xFFD700, 0.9);
    g.fillCircle(x + 16, y + 6, 6);
    // Glow effect
    g.fillStyle(0xFFEB3B, 0.3);
    g.fillCircle(x + 16, y + 6, 10);
  }
  
  private renderFountain(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number): void {
    // Basin
    g.fillStyle(0x708090, 1);
    g.fillEllipse(x + w/2, y + h*0.7, w*0.45, h*0.25);
    
    // Water
    g.fillStyle(0x4169E1, 0.7);
    g.fillEllipse(x + w/2, y + h*0.7, w*0.4, h*0.2);
    
    // Central spout
    g.fillStyle(0x708090, 1);
    g.fillRect(x + w/2 - 4, y + h*0.3, 8, h*0.4);
    
    // Water spray
    g.fillStyle(0x87CEEB, 0.6);
    g.fillTriangle(x + w/2, y + 5, x + w/2 - 12, y + h*0.35, x + w/2 + 12, y + h*0.35);
  }
  
  private renderCampusGate(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number): void {
    // Iron posts
    g.fillStyle(0x2F4F4F, 1);
    g.fillRect(x, y, 8, h);
    g.fillRect(x + w - 8, y, 8, h);
    
    // Arch
    g.lineStyle(4, 0x2F4F4F, 1);
    g.beginPath();
    g.arc(x + w/2, y + 10, w/2 - 4, Math.PI, 0, false);
    g.strokePath();
    
    // Gold accent
    g.fillStyle(0xFFD700, 1);
    g.fillCircle(x + w/2, y + 8, 4);
  }
  
  private renderDefaultBuilding(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, building: BuildingObject): void {
    // Body
    g.fillStyle(building.color, 1);
    g.fillRect(x, y, w, h);
    g.lineStyle(2, 0x000000, 0.3);
    g.strokeRect(x, y, w, h);

    // Roof
    if (building.secondaryColor) {
      g.fillStyle(building.secondaryColor, 0.8);
      g.fillRect(x + 2, y + 2, w - 4, Math.ceil(h * 0.3));
    }
    
    // Windows
    g.fillStyle(0xFFEB3B, 0.6);
    const windowSpacing = 12;
    for (let wx = x + 10; wx < x + w - 10; wx += windowSpacing) {
        for (let wy = y + 20; wy < y + h - 10; wy += windowSpacing) {
            if (Math.random() > 0.2) {
                g.fillRect(wx, wy, 6, 6);
            }
        }
    }
    
    // Door
    g.fillStyle(0x333333, 1);
    g.fillRect(x + w/2 - 8, y + h - 20, 16, 20);
  }

  private renderPlant(plant: PlantObject): void {
    const x = plant.gridX * TILE_SIZE;
    const y = plant.gridY * TILE_SIZE;
    
    if (this.scene.textures.exists('plants_props_atlas')) {
        this.addDropShadow(x, y, plant.width * TILE_SIZE, plant.height * TILE_SIZE);
        let frameIndex = 0;
        if (plant.plantType.includes('TREE')) frameIndex = 0;
        else if (plant.plantType.includes('BUSH')) frameIndex = 1;
        else if (plant.plantType.includes('FLOWER')) frameIndex = 2;
        else frameIndex = 3;
        
        const sprite = this.scene.add.sprite(x, y, 'plants_props_atlas', frameIndex);
        sprite.setOrigin(0, 0);
        sprite.setDisplaySize(plant.width * TILE_SIZE, plant.height * TILE_SIZE);
        sprite.setDepth(y + plant.height * TILE_SIZE);
        this.plantsGroup.set(plant.id, sprite);
    } else {
        // Enhanced Fallback with Autumn Theme
        const graphics = this.scene.add.graphics();
        const width = plant.width * TILE_SIZE;
        const height = plant.height * TILE_SIZE;
        
        this.addDropShadow(x, y, width, height);

        // Autumn trees (orange, red, gold)
        if (plant.plantType === 'TREE_AUTUMN' || plant.plantType === 'TREE_MAPLE') {
          // Trunk
          graphics.fillStyle(0x8B4513, 1);
          graphics.fillRect(x + width*0.4, y + height*0.5, width*0.2, height*0.5);
          // Autumn foliage (layered circles)
          graphics.fillStyle(plant.color, 1);
          graphics.fillCircle(x + width/2, y + height/3, width/2);
          graphics.fillStyle(plant.secondaryColor || 0xDAA520, 0.8);
          graphics.fillCircle(x + width/2 - 8, y + height/3 - 3, width/3);
          graphics.fillCircle(x + width/2 + 8, y + height/3 + 2, width/4);
          // Scattered leaves
          graphics.fillStyle(0xB22222, 0.7);
          graphics.fillCircle(x + width/2 + 5, y + height/3 + 5, 4);
        } else if (plant.plantType.includes('TREE')) {
          // Regular tree
          graphics.fillStyle(0x8B4513, 1);
          graphics.fillRect(x + width*0.4, y + height*0.5, width*0.2, height*0.5);
          graphics.fillStyle(plant.color, 1);
          graphics.fillCircle(x + width/2, y + height/3, width/2);
          if (plant.secondaryColor) {
              graphics.fillStyle(plant.secondaryColor, 0.8);
              graphics.fillCircle(x + width/2 - 5, y + height/3 - 5, width/4);
          }
        } else if (plant.plantType === 'HEDGE_TRIMMED') {
          // Manicured hedge (rectangular, neat)
          graphics.fillStyle(plant.color, 1);
          graphics.fillRect(x + 2, y + height*0.3, width - 4, height*0.7);
          // Trimmed top edge highlight
          graphics.fillStyle(plant.secondaryColor || 0x3CB371, 0.8);
          graphics.fillRect(x + 2, y + height*0.3, width - 4, 4);
        } else if (plant.plantType === 'FLOWER_BED') {
          // Multi-color flower arrangement
          graphics.fillStyle(0x27AE60, 1); // Base soil/leaves
          graphics.fillRect(x, y + height*0.5, width, height*0.5);
          // Flowers
          const flowerColors = [0xDC143C, 0xFFD700, 0xFF6B6B, 0x9B59B6];
          for(let i = 0; i < 6; i++) {
            const fx = x + 4 + (i % 3) * (width/3);
            const fy = y + height*0.3 + Math.floor(i / 3) * 12;
            graphics.fillStyle(flowerColors[i % flowerColors.length], 1);
            graphics.fillCircle(fx, fy, 3);
          }
        } else if (plant.plantType === 'IVY_WALL') {
          // Climbing ivy
          graphics.fillStyle(plant.color, 1);
          graphics.fillRect(x + width*0.3, y, width*0.4, height);
          // Leaf clusters
          graphics.fillStyle(plant.secondaryColor || 0x006400, 0.9);
          for(let i = 0; i < 4; i++) {
            graphics.fillCircle(x + width*0.3 + (i % 2) * 10, y + 8 + i * 12, 5);
          }
        } else if (plant.plantType.includes('BUSH')) {
          graphics.fillStyle(plant.color, 1);
          graphics.fillCircle(x + width/2, y + height/2 + 5, width/3);
          graphics.fillCircle(x + width/3, y + height/2 + 5, width/4);
          graphics.fillCircle(x + width*0.6, y + height/2 + 5, width/4);
        } else {
          // Flowers/Misc
          graphics.fillStyle(plant.color, 1);
          graphics.fillCircle(x + width/2, y + height - 5, 4);
          graphics.fillStyle(0x27AE60, 1); // Stem
          graphics.fillRect(x + width/2 - 1, y + height - 5, 2, 5);
        }

        graphics.setDepth(y + height);
        this.plantsGroup.set(plant.id, graphics);
    }
  }
}
