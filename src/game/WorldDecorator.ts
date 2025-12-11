
// World Decoration System
// Adds visual enhancements like shadows, paths, water, and decorative elements

import Phaser from 'phaser';
import { TILE_SIZE } from '../../types';
import { SeededRNG } from '../utils/SeededRNG';
import { AutoTiler } from './AutoTiler';

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
   * Enhanced with elliptical/organic shadows for better depth perception
   */
  public addShadows(
    buildings: Array<{ gridX: number; gridY: number; width: number; height: number }>,
    plants: Array<{ gridX: number; gridY: number; width: number; height: number }>
  ): void {
    const shadowColor = 0x000000;
    const shadowAlpha = 0.2;

    this.graphics.fillStyle(shadowColor, shadowAlpha);

    // Building shadows (elliptical, offset to bottom-right)
    buildings.forEach(building => {
      const centerX = (building.gridX + building.width / 2) * TILE_SIZE + 2;
      const centerY = (building.gridY + building.height) * TILE_SIZE + 3;
      const radiusX = (building.width * TILE_SIZE) * 0.45;
      const radiusY = (building.height * TILE_SIZE) * 0.15;
      this.graphics.fillEllipse(centerX, centerY, radiusX, radiusY);
    });

    // Plant shadows (smaller ellipses)
    plants.forEach(plant => {
      const centerX = (plant.gridX + plant.width / 2) * TILE_SIZE;
      const centerY = (plant.gridY + plant.height) * TILE_SIZE + 2;
      const radiusX = (plant.width * TILE_SIZE) * 0.4;
      const radiusY = (plant.height * TILE_SIZE) * 0.12;
      this.graphics.fillEllipse(centerX, centerY, radiusX, radiusY);
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
    if (this.scene.textures.exists('path_tileset')) {
        const pathSpacing = 12;
        
        const placePath = (x: number, y: number) => {
            const sprite = this.scene.add.sprite(x * TILE_SIZE, y * TILE_SIZE, 'path_tileset', 1);
            sprite.setOrigin(0, 0);
            sprite.setDepth(-20);
        };

        // Horizontal paths
        for (let y = pathSpacing; y < height; y += pathSpacing) {
            for (let x = 0; x < width; x++) {
                placePath(x, y);
            }
        }

        // Vertical paths
        for (let x = pathSpacing; x < width; x += pathSpacing) {
            for (let y = 0; y < height; y++) {
                placePath(x, y);
            }
        }
    } else {
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
  }

  /**
   * Add water features (ponds, streams)
   */
  public addWaterFeatures(width: number, height: number): void {
    // Generate water grid
    const waterGrid = new Array(width).fill(0).map(() => new Array(height).fill(false));
    const pondCount = Math.floor((width * height) / 200);
    const usedPositions = new Set<string>();

    for (let i = 0; i < pondCount; i++) {
      let validPosition = false;
      let px = 0, py = 0;
      let attempts = 0;

      while (!validPosition && attempts < 50) {
        px = this.rng.range(2, width - 3);
        py = this.rng.range(2, height - 3);
        const coord = `${px},${py}`;
        if (!usedPositions.has(coord)) {
          validPosition = true;
          usedPositions.add(coord);
        }
        attempts++;
      }

      if (validPosition) {
        // Mark grid for a pond (irregular shape)
        const radius = 2;
        for(let dx = -radius; dx <= radius + 1; dx++) {
            for(let dy = -radius; dy <= radius + 1; dy++) {
                if (px + dx >= 0 && px + dx < width && py + dy >= 0 && py + dy < height) {
                    // Simple circle-ish shape
                    if (dx*dx + dy*dy <= radius*radius + 1) {
                        waterGrid[px+dx][py+dy] = true;
                    }
                }
            }
        }
      }
    }

    if (this.scene.textures.exists('water_tileset')) {
        for (let x = 0; x < width; x++) {
            for (let y = 0; y < height; y++) {
                if (waterGrid[x][y]) {
                    const bitmask = AutoTiler.calculateBitmask(x, y, (nx, ny) => {
                        if (nx < 0 || nx >= width || ny < 0 || ny >= height) return false;
                        return waterGrid[nx][ny];
                    });
                    const frame = AutoTiler.getTileIndex(bitmask);
                    const sprite = this.scene.add.sprite(x * TILE_SIZE, y * TILE_SIZE, 'water_tileset', frame);
                    sprite.setOrigin(0, 0);
                    sprite.setDepth(-10);
                }
            }
        }
    } else {
        // Fallback
        const waterGraphics = this.scene.add.graphics();
        waterGraphics.setDepth(-10);
        const waterColor = 0x4db8ff;
        waterGraphics.fillStyle(waterColor, 0.6);
        
        for (let x = 0; x < width; x++) {
            for (let y = 0; y < height; y++) {
                if (waterGrid[x][y]) {
                    waterGraphics.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                }
            }
        }
    }
  }

  /**
   * Add lights and atmosphere
   */
  public addAtmospherics(width: number, height: number): void {
    const atmosphereGraphics = this.scene.add.graphics();
    atmosphereGraphics.setDepth(-99); // Very far back

    // Subtle vignette effect (reduced intensity for better visibility)
    const centerX = (width * TILE_SIZE) / 2;
    const centerY = (height * TILE_SIZE) / 2;
    const maxDist = Math.sqrt(centerX * centerX + centerY * centerY);

    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const dx = x * TILE_SIZE - centerX;
        const dy = y * TILE_SIZE - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const darkness = Math.min(1, dist / maxDist * 0.1); // Reduced from 0.15 to 0.1

        atmosphereGraphics.fillStyle(0x000000, darkness * 0.02); // Reduced from 0.05 to 0.02
        atmosphereGraphics.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }
  }

  /**
   * Add decorative elements (rocks, stumps, flowers, mushrooms)
   * Enhanced for better visual fidelity
   */
  public addDecorations(width: number, height: number, density: number = 0.05): void {
    const decorGraphics = this.scene.add.graphics();
    decorGraphics.setDepth(5); // Just above terrain

    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        if (this.rng.random() < density) {
          const typeRoll = this.rng.random();
          
          // Random offset within tile to break grid look
          const offsetX = this.rng.range(4, 28);
          const offsetY = this.rng.range(4, 28);
          const px = x * TILE_SIZE + offsetX;
          const py = y * TILE_SIZE + offsetY;

          if (typeRoll < 0.4) {
            // Grass Tufts (Common)
            decorGraphics.fillStyle(0x52b788, 0.5);
            decorGraphics.fillCircle(px, py, 2);
            decorGraphics.fillCircle(px - 2, py + 2, 2);
            decorGraphics.fillCircle(px + 2, py + 2, 2);
          } else if (typeRoll < 0.6) {
            // Small Pebbles
            decorGraphics.fillStyle(0x7f8c8d, 0.6);
            decorGraphics.fillCircle(px, py, 1.5);
            decorGraphics.fillStyle(0x95a5a6, 0.6);
            decorGraphics.fillCircle(px + 3, py + 1, 1);
          } else if (typeRoll < 0.8) {
            // Flowers
            const flowerColors = [0xff6b6b, 0xfeca57, 0x54a0ff, 0xff9ff3];
            const color = this.rng.pick(flowerColors);
            
            // Stem
            decorGraphics.fillStyle(0x2ecc71, 0.8);
            decorGraphics.fillRect(px - 0.5, py, 1, 3);
            
            // Petals
            decorGraphics.fillStyle(color, 0.9);
            decorGraphics.fillCircle(px, py, 2);
          } else if (typeRoll < 0.9) {
            // Mushrooms
            decorGraphics.fillStyle(0xecf0f1, 0.9); // Stalk
            decorGraphics.fillRect(px - 1, py, 2, 3);
            decorGraphics.fillStyle(0xe74c3c, 0.9); // Cap
            decorGraphics.fillCircle(px, py, 2.5);
            // Dots
            decorGraphics.fillStyle(0xffffff, 0.8);
            decorGraphics.fillCircle(px - 1, py - 1, 0.5);
            decorGraphics.fillCircle(px + 1, py - 1, 0.5);
          } else {
            // Tree Stump or Log
            decorGraphics.fillStyle(0x8d6e63, 0.9);
            decorGraphics.fillCircle(px, py, 3);
            decorGraphics.fillStyle(0xa1887f, 0.9);
            decorGraphics.fillCircle(px, py, 2);
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
   * Create a dust particle effect at a position
   * Used for movement feedback or interactions
   */
  public createDustParticle(x: number, y: number): void {
    const particles = this.scene.add.particles(x, y, 'path_tileset', {
      frame: 0,
      speed: { min: 20, max: 40 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.3, end: 0 },
      alpha: { start: 0.6, end: 0 },
      lifespan: 400,
      quantity: 3,
      blendMode: 'ADD'
    });
    
    // Auto-cleanup after emission
    this.scene.time.delayedCall(500, () => {
      particles.destroy();
    });
  }

  /**
   * Create an interaction sparkle effect (for conversations/interactions)
   */
  public createInteractionEffect(x: number, y: number): void {
    const graphics = this.scene.add.graphics();
    graphics.setDepth(1000);
    
    // Draw a star/sparkle
    graphics.fillStyle(0x00ff88, 0.8);
    const size = 8;
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
      const px = x + Math.cos(angle) * size;
      const py = y + Math.sin(angle) * size;
      graphics.fillCircle(px, py, 2);
    }
    
    // Fade out and destroy
    this.scene.tweens.add({
      targets: graphics,
      alpha: 0,
      scaleX: 1.5,
      scaleY: 1.5,
      duration: 600,
      ease: 'Quad.easeOut',
      onComplete: () => graphics.destroy()
    });
  }

  /**
   * Destroy all decorator graphics
   */
  public destroy(): void {
    this.graphics.destroy();
  }
}
