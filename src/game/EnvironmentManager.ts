
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
    // Phase 1: Place buildings (University Campus Layout)
    this.placeBuildings();

    // Phase 2: Place plants (vegetation)
    this.placePlants();

    return this.layer;
  }

  /**
   * Place buildings across the map using a University Campus layout
   */
  private placeBuildings(): void {
    const cx = Math.floor(this.worldWidth / 2);
    const cy = Math.floor(this.worldHeight / 2);

    // 1. Central Quad Feature
    this.tryPlaceBuilding(cx - 1, cy, BuildingType.FOUNTAIN); // Center fountain

    // 2. Core University Buildings
    // Library (North)
    this.tryPlaceBuilding(cx - 3, cy - 8, BuildingType.LIBRARY);
    
    // Student Life Center (East) - Using CAFE as proxy
    this.tryPlaceBuilding(cx + 6, cy - 2, BuildingType.CAFE);
    
    // Gym (West) - Using WAREHOUSE as proxy
    this.tryPlaceBuilding(cx - 9, cy - 3, BuildingType.WAREHOUSE);

    // Lab/Research (North East)
    this.tryPlaceBuilding(cx + 6, cy - 8, BuildingType.LAB);

    // 3. Residential Apartments (Surrounding Ring)
    // Using HOUSE and OFFICE (as dorms) assets
    const dormLocations = [
        // South Cluster
        { x: cx - 12, y: cy + 6, type: BuildingType.HOUSE },
        { x: cx - 8, y: cy + 8, type: BuildingType.HOUSE },
        { x: cx - 4, y: cy + 10, type: BuildingType.HOUSE },
        { x: cx + 4, y: cy + 10, type: BuildingType.HOUSE },
        { x: cx + 8, y: cy + 8, type: BuildingType.HOUSE },
        { x: cx + 12, y: cy + 6, type: BuildingType.HOUSE },
        
        // West Wing
        { x: cx - 14, y: cy - 2, type: BuildingType.HOUSE },
        { x: cx - 14, y: cy - 8, type: BuildingType.HOUSE },

        // East Wing (Faculty Housing?)
        { x: cx + 14, y: cy + 2, type: BuildingType.HOUSE },
    ];

    dormLocations.forEach(loc => {
        this.tryPlaceBuilding(loc.x, loc.y, loc.type);
    });

    // 4. Campus Decorations (Benches)
    const benchLocations = [
        { x: cx - 3, y: cy + 3 },
        { x: cx + 3, y: cy + 3 },
        { x: cx, y: cy - 3 },
        { x: cx - 3, y: cy - 2 },
        { x: cx + 4, y: cy - 2 },
    ];

    benchLocations.forEach(loc => {
        this.tryPlaceBuilding(loc.x, loc.y, BuildingType.PARK_BENCH);
    });

    console.log(`Generated ${this.layer.buildings.length} buildings (University Layout)`);
  }

  /**
   * Helper to place a specific building type at x,y
   */
  private tryPlaceBuilding(x: number, y: number, type: BuildingType): boolean {
      const config = BUILDINGS[type];
      
      // Boundary checks
      if (x < 1 || y < 1 || x + config.width >= this.worldWidth - 1 || y + config.height >= this.worldHeight - 1) {
          return false;
      }

      // Check collision
      if (this.canPlaceBuilding(x, y, config.width, config.height)) {
        const building: BuildingObject = {
          id: `building-${this.buildingCount++}`,
          type: 'building',
          buildingType: type,
          gridX: x,
          gridY: y,
          width: config.width,
          height: config.height,
          color: config.color,
          secondaryColor: config.roofColor,
          isPassable: config.isPassable
        };

        this.layer.buildings.push(building);
        this.markBuildingOccupancy(x, y, config.width, config.height);
        return true;
      }
      return false;
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

    // Create a central quad clearing
    const cx = Math.floor(this.worldWidth / 2);
    const cy = Math.floor(this.worldHeight / 2);
    const quadRadius = 6;

    for (let x = 0; x < this.worldWidth; x++) {
      for (let y = 0; y < this.worldHeight; y++) {
        const coord = `${x},${y}`;

        // Skip if occupied by building
        if (this.layer.obstacles.has(coord)) {
          continue;
        }

        // Keep central quad relatively clear of large trees, mostly grass/flowers
        const distFromCenter = Math.sqrt(Math.pow(x - cx, 2) + Math.pow(y - cy, 2));
        let isQuad = distFromCenter < quadRadius;

        // Randomly select plant type based on density
        const rand = this.rng.random();
        // Lower density in quad
        const densityLevel: 'low' | 'medium' | 'high' = isQuad ? 'low' : 
          (rand > 0.7 ? 'low' : rand > 0.5 ? 'medium' : 'high');

        const diceRoll = this.rng.random();
        const threshold = plantDensityFactors[densityLevel];

        if (diceRoll < threshold) {
          let plants = getPlantsByDensity(densityLevel);
          
          // If in quad, prefer flowers and small bushes
          if (isQuad) {
              plants = plants.filter(p => p.includes('FLOWER') || p.includes('GRASS') || p === PlantType.BUSH_SMALL);
              if (plants.length === 0) continue; 
          }

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
