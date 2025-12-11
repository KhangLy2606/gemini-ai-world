
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

    // 3. Fallback to Graphics
    const graphics = this.scene.add.graphics();
    const width = building.width * TILE_SIZE;
    const height = building.height * TILE_SIZE;

    this.addDropShadow(x, y, width, height);
    
    // Body
    graphics.fillStyle(building.color, 1);
    graphics.fillRect(x, y, width, height);
    graphics.lineStyle(2, 0x000000, 0.3);
    graphics.strokeRect(x, y, width, height);

    // Roof
    if (building.secondaryColor) {
      graphics.fillStyle(building.secondaryColor, 0.8);
      graphics.fillRect(x + 2, y + 2, width - 4, Math.ceil(height * 0.3));
    }
    
    // Windows (Procedural)
    graphics.fillStyle(0xffeb3b, 0.6); // Lit window
    const windowSize = 8;
    const windowSpacing = 12;
    for (let wx = x + 10; wx < x + width - 10; wx += windowSpacing) {
        for (let wy = y + 20; wy < y + height - 10; wy += windowSpacing) {
            if (Math.random() > 0.2) { // 80% lit
                graphics.fillRect(wx, wy, 6, 6);
            }
        }
    }
    
    // Door
    graphics.fillStyle(0x333333, 1);
    graphics.fillRect(x + width/2 - 8, y + height - 20, 16, 20);

    graphics.setDepth(y + height);
    this.buildingsGroup.set(building.id, graphics);
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
        // Fallback
        const graphics = this.scene.add.graphics();
        const width = plant.width * TILE_SIZE;
        const height = plant.height * TILE_SIZE;
        
        this.addDropShadow(x, y, width, height);

        if (plant.plantType.includes('TREE')) {
          // Trunk
          graphics.fillStyle(0x8b4513, 1);
          graphics.fillRect(x + width*0.4, y + height*0.5, width*0.2, height*0.5);
          // Leaves (Triangular or Circular)
          graphics.fillStyle(plant.color, 1);
          graphics.fillCircle(x + width/2, y + height/3, width/2);
          if (plant.secondaryColor) {
              graphics.fillStyle(plant.secondaryColor, 0.8);
              graphics.fillCircle(x + width/2 - 5, y + height/3 - 5, width/4);
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
          graphics.fillStyle(0x00ff00, 1); // Stem
          graphics.fillRect(x + width/2 - 1, y + height - 5, 2, 5);
        }

        graphics.setDepth(y + height);
        this.plantsGroup.set(plant.id, graphics);
    }
  }
}
