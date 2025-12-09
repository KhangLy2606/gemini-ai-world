// World Decoration System
// Adds visual enhancements like shadows, paths, water, and decorative elements

import Phaser from 'phaser';
import { TILE_SIZE } from '../../types';
import { SeededRNG } from '../utils/SeededRNG';

export interface TerrainTile {
  type: 'grass' | 'path' | 'water' | 'sand';
  color: number;
  x: number;
  y: number;
}

export class WorldDecorator {
  private scene: Phaser.Scene;
  private graphics: Phaser.GameObjects.Graphics;
  private rng: SeededRNG;

  constructor(scene: Phaser.Scene, seed: number = 12345) {
    this.scene = scene;
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(-50); // Behind terrain
    this.rng = new SeededRNG(seed);
  }

  /**
   * Add shadows under buildings and plants
   */
  public addShadows(
    buildings: Array<{ gridX: number; gridY: number; width: number; height: number }>,
    plants: Array<{ gridX: number; gridY: number; width: number; height: number }>
  ): void {
    const shadowColor = 0x000000;
    const shadowAlpha = 0.15;

    this.graphics.fillStyle(shadowColor, shadowAlpha);

    // Building shadows (offset to bottom-right)
    buildings.forEach(building => {
      const x = building.gridX * TILE_SIZE + 2;
      const y = building.gridY * TILE_SIZE + building.height * TILE_SIZE - 4;
      this.graphics.fillRect(x, y, building.width * TILE_SIZE - 2, 3);
    });

    // Plant shadows
    plants.forEach(plant => {
      const x = plant.gridX * TILE_SIZE + 1;
      const y = plant.gridY * TILE_SIZE + plant.height * TILE_SIZE - 2;
      this.graphics.fillRect(x, y, plant.width * TILE_SIZE - 1, 2);
    });
  }

  /**
   * Add pathways between buildings
   */
  public addPathways(
    width: number,
    height: number,
    buildingPositions: Array<{ gridX: number; gridY: number; w: number; h: number }>
  ): void {
    const pathGraphics = this.scene.add.graphics();
    pathGraphics.setDepth(-20);

    // Create paths using simple grid pattern
    const pathSpacing = 12; // Every 12 tiles
    const pathColor = 0x8b8b7a;
    const pathAlpha = 0.4;

    pathGraphics.fillStyle(pathColor, pathAlpha);

    // Horizontal paths
    for (let y = pathSpacing; y < height; y += pathSpacing) {
      pathGraphics.fillRect(0, y * TILE_SIZE, width * TILE_SIZE, TILE_SIZE);
    }

    // Vertical paths
    for (let x = pathSpacing; x < width; x += pathSpacing) {
      pathGraphics.fillRect(x * TILE_SIZE, 0, TILE_SIZE, height * TILE_SIZE);
    }

    // Add crossings at intersections
    const crossingColor = 0xa9a67e;
    pathGraphics.fillStyle(crossingColor, pathAlpha * 1.5);

    for (let x = pathSpacing; x < width; x += pathSpacing) {
      for (let y = pathSpacing; y < height; y += pathSpacing) {
        pathGraphics.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }
  }

  /**
   * Add water features (ponds, streams)
   */
  public addWaterFeatures(width: number, height: number): void {
    const waterGraphics = this.scene.add.graphics();
    waterGraphics.setDepth(-10);

    const waterColor = 0x4db8ff;
    waterGraphics.fillStyle(waterColor, 0.6);

    // Add scattered ponds
    const pondCount = Math.floor((width * height) / 200); // ~1 pond per 200 tiles
    const usedPositions = new Set<string>();

    for (let i = 0; i < pondCount; i++) {
      let validPosition = false;
      let px = 0,
        py = 0;

      // Find a valid position for pond
      while (!validPosition && px + 5 < width && py + 5 < height) {
        px = this.rng.range(0, width - 5);
        py = this.rng.range(0, height - 5);

        const coord = `${px},${py}`;
        if (!usedPositions.has(coord)) {
          validPosition = true;
          usedPositions.add(coord);
        }
      }

      if (validPosition) {
        // Draw pond (irregular shape using overlapping circles)
        const centerX = (px + 2.5) * TILE_SIZE;
        const centerY = (py + 2.5) * TILE_SIZE;
        const pondRadius = TILE_SIZE * 2.5;

        waterGraphics.fillCircle(centerX, centerY, pondRadius);
        waterGraphics.fillCircle(centerX + 10, centerY - 8, pondRadius * 0.7);
        waterGraphics.fillCircle(centerX - 12, centerY + 8, pondRadius * 0.6);
      }
    }
  }

  /**
   * Add lights and atmosphere
   */
  public addAtmospherics(width: number, height: number): void {
    const atmosphereGraphics = this.scene.add.graphics();
    atmosphereGraphics.setDepth(-99); // Very far back

    // Subtle vignette effect
    const centerX = (width * TILE_SIZE) / 2;
    const centerY = (height * TILE_SIZE) / 2;
    const maxDist = Math.sqrt(centerX * centerX + centerY * centerY);

    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const dx = x * TILE_SIZE - centerX;
        const dy = y * TILE_SIZE - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const darkness = Math.min(1, dist / maxDist * 0.15);

        atmosphereGraphics.fillStyle(0x000000, darkness * 0.05);
        atmosphereGraphics.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }
  }

  /**
   * Add decorative elements (rocks, stumps, signs)
   */
  public addDecorations(width: number, height: number, density: number = 0.02): void {
    const decorGraphics = this.scene.add.graphics();
    decorGraphics.setDepth(5); // Just above terrain

    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        if (this.rng.random() < density) {
          const decorType = Math.floor(this.rng.random() * 3);
          const px = x * TILE_SIZE + TILE_SIZE / 2;
          const py = y * TILE_SIZE + TILE_SIZE / 2;

          if (decorType === 0) {
            // Rock
            decorGraphics.fillStyle(0x696969, 0.7);
            decorGraphics.fillCircle(px, py, 4);
            decorGraphics.fillStyle(0x505050, 0.5);
            decorGraphics.fillCircle(px - 2, py - 1, 2);

          } else if (decorType === 1) {
            // Stump
            decorGraphics.fillStyle(0x8b4513, 0.8);
            decorGraphics.fillCircle(px, py, 3);
            decorGraphics.lineStyle(1, 0x654321, 0.6);
            decorGraphics.strokeCircle(px, py, 3);

          } else {
            // Grass tuft
            decorGraphics.fillStyle(0x52b788, 0.6);
            decorGraphics.fillCircle(px - 2, py, 2);
            decorGraphics.fillCircle(px + 2, py, 2);
            decorGraphics.fillCircle(px, py - 1, 1.5);
          }
        }
      }
    }
  }

  /**
   * Add terrain variation with noise-like patterns
   */
  public addTerrainVariation(width: number, height: number): void {
    const terrainGraphics = this.scene.add.graphics();
    terrainGraphics.setDepth(-15);

    // Simple perlin-like variation using sine waves
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const noise = Math.sin(x * 0.3) * Math.cos(y * 0.3) * 0.5 + 0.5;

        if (noise > 0.7) {
          // Slightly darker patches
          terrainGraphics.fillStyle(0x2d5a27, 0.3);
          terrainGraphics.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        } else if (noise < 0.3) {
          // Slightly lighter patches
          terrainGraphics.fillStyle(0x35682d, 0.2);
          terrainGraphics.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }
      }
    }
  }

  /**
   * Draw a simple compass in the corner
   */
  public addCompass(x: number, y: number): void {
    const compassGraphics = this.scene.add.graphics();
    compassGraphics.setDepth(1000);
    compassGraphics.setScrollFactor(0); // Fixed to camera

    const size = 20;

    // Background circle
    compassGraphics.fillStyle(0x000000, 0.3);
    compassGraphics.fillCircle(x, y, size + 5);

    // Cardinal directions
    compassGraphics.fillStyle(0xffffff, 0.8);
    compassGraphics.fillCircle(x, y - size, 3); // N
    compassGraphics.fillCircle(x, y + size, 2); // S
    compassGraphics.fillCircle(x - size, y, 2); // W
    compassGraphics.fillCircle(x + size, y, 2); // E

    // Cardinal letters
    const text = this.scene.add.text(x, y - size - 8, 'N', {
      fontSize: '8px',
      color: '#ffffff'
    });
    text.setOrigin(0.5);
    text.setScrollFactor(0);
    text.setDepth(1001);
  }

  /**
   * Destroy all decorator graphics
   */
  public destroy(): void {
    this.graphics.destroy();
  }
}
