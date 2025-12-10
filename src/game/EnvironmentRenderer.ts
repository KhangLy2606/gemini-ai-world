// Environment Renderer
// Handles the visual representation of the environment
// Decouples rendering logic from the MainScene

import Phaser from 'phaser';
import { BuildingObject, PlantObject, TILE_SIZE } from '../../types';
import { WorldDecorator } from './WorldDecorator';
import { AutoTiler } from './AutoTiler';

export class EnvironmentRenderer {
  private scene: Phaser.Scene;
  private buildingsGroup: Map<string, Phaser.GameObjects.Sprite | Phaser.GameObjects.Graphics> = new Map();
  private plantsGroup: Map<string, Phaser.GameObjects.Sprite | Phaser.GameObjects.Graphics> = new Map();
  private decorator: WorldDecorator;

  constructor(scene: Phaser.Scene, seed: number = 12345) {
    this.scene = scene;
    this.decorator = new WorldDecorator(scene, seed);
  }

  /**
   * Render the entire environment
   */
  public render(
    width: number,
    height: number,
    buildings: BuildingObject[],
    plants: PlantObject[]
  ): void {
    // 1. Base Terrain
    this.renderTerrain(width, height);

    // 2. Decorators (Atmosphere, Water, Paths)
    this.decorator.addTerrainVariation(width, height);
    this.decorator.addAtmospherics(width, height);
    this.decorator.addWaterFeatures(width, height);
    
    const buildingRects = buildings.map(b => ({ 
      gridX: b.gridX, gridY: b.gridY, w: b.width, h: b.height 
    }));
    this.decorator.addPathways(width, height, buildingRects);
    this.decorator.addDecorations(width, height, 0.025);

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

  /**
   * Update depth sorting for dynamic layering
   */
  public updateDepth(): void {
    // Buildings are static, but we ensure they stay in correct layer range
    this.buildingsGroup.forEach(building => {
      const currentDepth = building.depth;
      const minDepth = 10;
      if (currentDepth < minDepth) building.setDepth(minDepth);
    });

    // Plants are static
    this.plantsGroup.forEach(plant => {
      const currentDepth = plant.depth;
      const minDepth = 20;
      if (currentDepth < minDepth) plant.setDepth(minDepth);
    });
  }

  /**
   * Cleanup all graphics
   */
  public destroy(): void {
    this.buildingsGroup.forEach(g => g.destroy());
    this.plantsGroup.forEach(g => g.destroy());
    this.buildingsGroup.clear();
    this.plantsGroup.clear();
    this.decorator.destroy();
  }

  /**
   * Add elliptical drop shadow under a sprite for depth ("grounding effect")
   */
  private addDropShadow(x: number, y: number, width: number, height: number): void {
    const shadowGraphics = this.scene.add.graphics();
    shadowGraphics.setDepth(-5); // Just above terrain
    
    // Draw elliptical shadow
    const shadowCenterX = x + (width / 2);
    const shadowCenterY = y + height + 4; // Offset below object
    const shadowRadiusX = width * 0.4;
    const shadowRadiusY = height * 0.15;
    
    shadowGraphics.fillStyle(0x000000, 0.3);
    shadowGraphics.fillEllipse(shadowCenterX, shadowCenterY, shadowRadiusX, shadowRadiusY);
  }

  private renderTerrain(width: number, height: number): void {
    // Create tilemap
    const map = this.scene.make.tilemap({ 
      tileWidth: 32, 
      tileHeight: 32, 
      width: width, 
      height: height 
    });
    const tileset = map.addTilesetImage('grass_tileset', 'grass_tileset', 32, 32);
    
    if (tileset) {
        const layer = map.createBlankLayer('terrain', tileset, 0, 0, width, height);
        if (layer) {
            // Use AutoTiler for grass
            for (let x = 0; x < width; x++) {
                for (let y = 0; y < height; y++) {
                    // Check if neighbor is within bounds (valid grass)
                    // Currently assuming entire map is grass base
                    const isGrass = (nx: number, ny: number) => {
                        return nx >= 0 && nx < width && ny >= 0 && ny < height;
                    };
                    
                    const bitmask = AutoTiler.calculateBitmask(x, y, isGrass);
                    const tileIndex = AutoTiler.getTileIndex(bitmask);
                    layer.putTileAt(tileIndex, x, y);
                }
            }
            layer.setDepth(-100);
        }
    } else {
        // Fallback if tileset failed to load
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

  private renderBuilding(building: BuildingObject): void {
    const x = building.gridX * TILE_SIZE;
    const y = building.gridY * TILE_SIZE;
    
    // Determine frame based on building type
    let frameIndex = 0;
    if (building.buildingType.includes('TECH')) frameIndex = 0;
    else if (building.buildingType.includes('HOSPITAL')) frameIndex = 1;
    else if (building.buildingType.includes('CAFE')) frameIndex = 2;
    else if (building.buildingType.includes('LIBRARY')) frameIndex = 3;
    else if (building.buildingType.includes('LAB')) frameIndex = 4;
    
    // Check if texture exists
    if (this.scene.textures.exists('buildings_atlas')) {
        // Add drop shadow for depth
        this.addDropShadow(x, y, building.width * TILE_SIZE, building.height * TILE_SIZE);
        
        const sprite = this.scene.add.sprite(x, y, 'buildings_atlas', frameIndex);
        sprite.setOrigin(0, 0);
        sprite.setDisplaySize(building.width * TILE_SIZE, building.height * TILE_SIZE);
        sprite.setDepth(y + building.height * TILE_SIZE);
        this.buildingsGroup.set(building.id, sprite);
    } else {
        // Fallback to graphics
        const graphics = this.scene.add.graphics();
        const width = building.width * TILE_SIZE;
        const height = building.height * TILE_SIZE;

        // Drop shadow
        this.addDropShadow(x, y, width, height);
        
        // Main building body
        graphics.fillStyle(building.color, 1);
        graphics.fillRect(x, y, width, height);

        // Building outline
        graphics.lineStyle(2, 0x000000, 0.3);
        graphics.strokeRect(x, y, width, height);

        // Roof (secondary color)
        if (building.secondaryColor) {
          graphics.fillStyle(building.secondaryColor, 0.8);
          graphics.fillRect(x + 2, y + 2, width - 4, Math.ceil(height * 0.3));
        }
        
        // Add windows for large buildings (visual interest)
        if (width >= 64 && height >= 64) {
          graphics.fillStyle(0xffeb3b, 0.6);
          const windowSize = 8;
          const windowPadding = 12;
          
          for (let wx = x + windowPadding; wx < x + width - windowPadding; wx += windowSize + windowPadding) {
            for (let wy = y + windowPadding + 12; wy < y + height - windowPadding; wy += windowSize + windowPadding) {
              graphics.fillRect(wx, wy, windowSize, windowSize);
            }
          }
        }
        
        graphics.setDepth(y + height);
        this.buildingsGroup.set(building.id, graphics);
    }
  }

  private renderPlant(plant: PlantObject): void {
    const x = plant.gridX * TILE_SIZE;
    const y = plant.gridY * TILE_SIZE;
    
    let frameIndex = 0;
    if (plant.plantType.includes('TREE')) frameIndex = 0;
    else if (plant.plantType.includes('BUSH')) frameIndex = 1;
    else if (plant.plantType.includes('FLOWER')) frameIndex = 2;
    else frameIndex = 3; // Prop
    
    if (this.scene.textures.exists('plants_props_atlas')) {
        // Add drop shadow for depth
        this.addDropShadow(x, y, plant.width * TILE_SIZE, plant.height * TILE_SIZE);
        
        const sprite = this.scene.add.sprite(x, y, 'plants_props_atlas', frameIndex);
        sprite.setOrigin(0, 0);
        sprite.setDisplaySize(plant.width * TILE_SIZE, plant.height * TILE_SIZE);
        sprite.setDepth(y + plant.height * TILE_SIZE);
        this.plantsGroup.set(plant.id, sprite);
    } else {
        // Fallback
        const graphics = this.scene.add.graphics();
        const width = plant.width * TILE_SIZE;
        const height = plant.height * TILE_SIZE;
        
        // Drop shadow
        this.addDropShadow(x, y, width, height);

        // Draw plant based on type
        graphics.fillStyle(plant.color, 0.8);

        if (plant.plantType.includes('TREE')) {
          const trunkWidth = Math.max(4, width * 0.3);
          graphics.fillRect(x + (width - trunkWidth) / 2, y + height * 0.6, trunkWidth, height * 0.4);
          if (plant.secondaryColor) graphics.fillStyle(plant.secondaryColor, 0.9);
          graphics.fillCircle(x + width / 2, y + height * 0.5, width / 2);
          
        } else if (plant.plantType.includes('BUSH')) {
          graphics.fillCircle(x + width / 4, y + height * 0.6, width * 0.35);
          graphics.fillCircle(x + (width * 0.75), y + height * 0.6, width * 0.35);
          graphics.fillCircle(x + width / 2, y + height * 0.3, width * 0.4);

        } else {
          graphics.fillRect(x, y, width, height);
        }

        graphics.setDepth(y + height);
        this.plantsGroup.set(plant.id, graphics);
    }
  }
}
