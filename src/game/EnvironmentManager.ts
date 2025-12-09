// Environment Manager for Procedural World Generation
// Handles placement and rendering of buildings, plants, and infrastructure

import { TILE_SIZE, BuildingObject, PlantObject } from '../../types';
import {
  BUILDINGS,
  PLANTS,
  BuildingType,
  PlantType,
  getPlantsByDensity
} from '../config/EnvironmentRegistry';
import { SeededRNG } from '../utils/SeededRNG';

export interface EnvironmentLayer {
  buildings: BuildingObject[];
  plants: PlantObject[];
  obstacles: Set<string>; // grid coordinates as "x,y" for collision detection
}

export class EnvironmentManager {
  private layer: EnvironmentLayer;
  private worldWidth: number;
  private worldHeight: number;
  private buildingCount: number = 0;
  private plantCount: number = 0;
  private rng: SeededRNG;

  constructor(worldWidth: number, worldHeight: number, seed: number = 12345) {
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    this.rng = new SeededRNG(seed);
    this.layer = {
      buildings: [],
      plants: [],
      obstacles: new Set()
    };
  }

  /**
   * Generate the entire environment layer for the world
   */
  public generateEnvironment(): EnvironmentLayer {
    // Phase 1: Place buildings (structures)
    this.placeBuildings();

    // Phase 2: Place plants (vegetation)
    this.placePlants();

    return this.layer;
  }

  /**
   * Place buildings across the map using spatial partitioning
   */
  private placeBuildings(): void {
    const buildingDensity = 0.08; // 8% of map area covered by buildings
    const targetArea = (this.worldWidth * this.worldHeight) * buildingDensity;
    let coveredArea = 0;

    // Attempt to place buildings until we reach target coverage
    const maxAttempts = 200;
    let attempts = 0;

    const buildingTypes = Object.values(BuildingType);

    while (coveredArea < targetArea && attempts < maxAttempts) {
      attempts++;

      const buildingType = this.rng.pick(buildingTypes);
      const config = BUILDINGS[buildingType];

      // Random position
      const x = this.rng.range(0, this.worldWidth - config.width);
      const y = this.rng.range(0, this.worldHeight - config.height);

      // Check if space is available
      if (this.canPlaceBuilding(x, y, config.width, config.height)) {
        const building: BuildingObject = {
          id: `building-${this.buildingCount++}`,
          type: 'building',
          buildingType,
          gridX: x,
          gridY: y,
          width: config.width,
          height: config.height,
          color: config.color,
          secondaryColor: config.roofColor,
          isPassable: config.isPassable
        };

        this.layer.buildings.push(building);

        // Mark tiles as occupied
        this.markBuildingOccupancy(x, y, config.width, config.height);

        coveredArea += config.width * config.height;
      }
    }

    console.log(`Generated ${this.layer.buildings.length} buildings`);
  }

  /**
   * Place plants across available spaces
   */
  private placePlants(): void {
    const plantDensityFactors = {
      low: 0.02,     // 2% spawn chance
      medium: 0.05,  // 5% spawn chance
      high: 0.12     // 12% spawn chance
    };

    for (let x = 0; x < this.worldWidth; x++) {
      for (let y = 0; y < this.worldHeight; y++) {
        const coord = `${x},${y}`;

        // Skip if occupied by building
        if (this.layer.obstacles.has(coord)) {
          continue;
        }

        // Randomly select plant type based on density
        const rand = this.rng.random();
        const densityLevel: 'low' | 'medium' | 'high' =
          rand > 0.7 ? 'low' : rand > 0.5 ? 'medium' : 'high';

        const diceRoll = this.rng.random();
        const threshold = plantDensityFactors[densityLevel];

        if (diceRoll < threshold) {
          const plants = getPlantsByDensity(densityLevel);
          const plantType = this.rng.pick(plants);
          const config = PLANTS[plantType];

          // Can this plant fit here?
          if (this.canPlacePlant(x, y, config.width, config.height)) {
            const plant: PlantObject = {
              id: `plant-${this.plantCount++}`,
              type: 'plant',
              plantType,
              gridX: x,
              gridY: y,
              width: config.width,
              height: config.height,
              color: config.color,
              secondaryColor: config.leafColor,
              canWalkThrough: config.canWalkThrough
            };

            this.layer.plants.push(plant);

            // Mark tiles if plant doesn't allow walking through
            if (!config.canWalkThrough) {
              this.markPlantOccupancy(x, y, config.width, config.height);
            }
          }
        }
      }
    }

    console.log(`Generated ${this.layer.plants.length} plants`);
  }

  /**
   * Check if a building can be placed at given position
   */
  private canPlaceBuilding(x: number, y: number, width: number, height: number): boolean {
    // Check bounds
    if (x + width > this.worldWidth || y + height > this.worldHeight) {
      return false;
    }

    // Check collision with existing buildings and obstacles
    for (let dx = 0; dx < width; dx++) {
      for (let dy = 0; dy < height; dy++) {
        const coord = `${x + dx},${y + dy}`;
        if (this.layer.obstacles.has(coord)) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Check if a plant can be placed at given position
   */
  private canPlacePlant(x: number, y: number, width: number, height: number): boolean {
    // Check bounds
    if (x + width > this.worldWidth || y + height > this.worldHeight) {
      return false;
    }

    // Plants can overlap with each other and walkable objects
    // but not with buildings
    for (let dx = 0; dx < width; dx++) {
      for (let dy = 0; dy < height; dy++) {
        const coord = `${x + dx},${y + dy}`;
        // Only blocked if there's a building (obstacle set contains both buildings and blocking plants)
        // Check if it's a building by looking at x,y directly
        if (this.layer.obstacles.has(coord)) {
          const isBuilding = this.layer.buildings.some(
            b => x >= b.gridX && x < b.gridX + b.width &&
                 y >= b.gridY && y < b.gridY + b.height
          );
          if (isBuilding) return false;
        }
      }
    }

    return true;
  }

  /**
   * Mark building footprint as occupied
   */
  private markBuildingOccupancy(x: number, y: number, width: number, height: number): void {
    for (let dx = 0; dx < width; dx++) {
      for (let dy = 0; dy < height; dy++) {
        this.layer.obstacles.add(`${x + dx},${y + dy}`);
      }
    }
  }

  /**
   * Mark plant footprint as occupied (if blocking)
   */
  private markPlantOccupancy(x: number, y: number, width: number, height: number): void {
    for (let dx = 0; dx < width; dx++) {
      for (let dy = 0; dy < height; dy++) {
        this.layer.obstacles.add(`${x + dx},${y + dy}`);
      }
    }
  }

  /**
   * Get all environment objects (buildings + plants) for rendering
   */
  public getAllObjects(): (BuildingObject | PlantObject)[] {
    return [...this.layer.buildings, ...this.layer.plants];
  }

  /**
   * Get buildings only
   */
  public getBuildings(): BuildingObject[] {
    return this.layer.buildings;
  }

  /**
   * Get plants only
   */
  public getPlants(): PlantObject[] {
    return this.layer.plants;
  }

  /**
   * Check if a grid position is walkable
   */
  public isWalkable(gridX: number, gridY: number): boolean {
    const coord = `${gridX},${gridY}`;
    return !this.layer.obstacles.has(coord);
  }

  /**
   * Get collision map as 2D array (useful for pathfinding)
   */
  public getCollisionMap(): number[][] {
    const map: number[][] = Array(this.worldHeight)
      .fill(null)
      .map(() => Array(this.worldWidth).fill(0));

    for (const coord of this.layer.obstacles) {
      const [x, y] = coord.split(',').map(Number);
      if (x >= 0 && x < this.worldWidth && y >= 0 && y < this.worldHeight) {
        map[y][x] = 1;
      }
    }

    return map;
  }
}
