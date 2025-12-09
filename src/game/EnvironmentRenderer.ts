// Environment Renderer
// Handles the visual representation of the environment
// Decouples rendering logic from the MainScene

import Phaser from 'phaser';
import { BuildingObject, PlantObject, TILE_SIZE } from '../../types';
import { WorldDecorator } from './WorldDecorator';

export class EnvironmentRenderer {
  private scene: Phaser.Scene;
  private buildingsGroup: Map<string, Phaser.GameObjects.Graphics> = new Map();
  private plantsGroup: Map<string, Phaser.GameObjects.Graphics> = new Map();
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

  private renderTerrain(width: number, height: number): void {
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

  private renderBuilding(building: BuildingObject): void {
    const graphics = this.scene.add.graphics();
    const x = building.gridX * TILE_SIZE;
    const y = building.gridY * TILE_SIZE;
    const width = building.width * TILE_SIZE;
    const height = building.height * TILE_SIZE;

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

    // Windows (for large buildings)
    if (width >= 64 && height >= 64) {
      graphics.fillStyle(0xffeb3b, 0.6); // Yellow windows
      const windowSize = 8;
      const windowPadding = 12;
      
      for (let wx = x + windowPadding; wx < x + width - windowPadding; wx += windowSize + windowPadding) {
        for (let wy = y + windowPadding + 12; wy < y + height - windowPadding; wy += windowSize + windowPadding) {
          graphics.fillRect(wx, wy, windowSize, windowSize);
        }
      }
    }

    // Depth sorting: buildings are lower than plants
    graphics.setDepth(y + height);
    this.buildingsGroup.set(building.id, graphics);
  }

  private renderPlant(plant: PlantObject): void {
    const graphics = this.scene.add.graphics();
    const x = plant.gridX * TILE_SIZE;
    const y = plant.gridY * TILE_SIZE;
    const width = plant.width * TILE_SIZE;
    const height = plant.height * TILE_SIZE;

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

    } else if (plant.plantType.includes('FLOWER')) {
      const petalCount = 5;
      const petalRadius = width * 0.25;
      const centerX = x + width / 2;
      const centerY = y + height / 2;

      for (let i = 0; i < petalCount; i++) {
        const angle = (i / petalCount) * Math.PI * 2;
        const px = centerX + Math.cos(angle) * petalRadius;
        const py = centerY + Math.sin(angle) * petalRadius;
        graphics.fillCircle(px, py, width * 0.15);
      }
      if (plant.secondaryColor) graphics.fillStyle(plant.secondaryColor, 0.9);
      graphics.fillCircle(centerX, centerY, width * 0.1);

    } else if (plant.plantType.includes('HEDGE')) {
      graphics.fillRect(x, y + height * 0.4, width, height * 0.6);
      if (plant.secondaryColor) graphics.fillStyle(plant.secondaryColor, 0.9);
      const bumpSize = Math.min(6, width / 4);
      for (let bx = x; bx < x + width; bx += bumpSize) {
        graphics.fillCircle(bx, y + height * 0.35, bumpSize / 2);
      }

    } else if (plant.plantType.includes('BAMBOO')) {
      graphics.lineStyle(2, plant.color, 1);
      graphics.strokeRect(x + width * 0.3, y, width * 0.4, height);
      const segments = Math.floor(height / 8);
      for (let i = 0; i < segments; i++) {
        graphics.strokeLineCosmetic(x + width * 0.25, y + (i * 8), x + width * 0.75, y + (i * 8));
      }

    } else {
      graphics.fillRect(x, y, width, height);
    }

    graphics.setDepth(y + height);
    this.plantsGroup.set(plant.id, graphics);
  }
}
