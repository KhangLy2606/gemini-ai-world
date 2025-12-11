
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
   * Zone-based layout inspired by The Sims University
   */
  private placeBuildings(): void {
    const cx = Math.floor(this.worldWidth / 2);
    const cy = Math.floor(this.worldHeight / 2);

    // ========================================
    // ZONE 1: Central Quad (Heart of Campus)
    // ========================================
    
    // Iconic Clock Tower (center-north of quad)
    this.tryPlaceBuilding(cx - 1, cy - 4, BuildingType.CLOCK_TOWER);
    
    // Central Fountain
    this.tryPlaceBuilding(cx - 1, cy, BuildingType.FOUNTAIN);
    
    // Statue near fountain
    this.tryPlaceBuilding(cx + 2, cy - 1, BuildingType.STATUE);
    this.tryPlaceBuilding(cx - 3, cy - 1, BuildingType.STATUE);
    
    // Benches around the quad
    const quadBenches = [
      { x: cx - 4, y: cy + 2 },
      { x: cx + 3, y: cy + 2 },
      { x: cx - 4, y: cy - 2 },
      { x: cx + 3, y: cy - 2 },
      { x: cx, y: cy + 3 },
    ];
    quadBenches.forEach(loc => this.tryPlaceBuilding(loc.x, loc.y, BuildingType.PARK_BENCH));

    // ========================================
    // ZONE 2: Academic Zone (North)
    // ========================================
    
    // Library (grand, north-west)
    this.tryPlaceBuilding(cx - 8, cy - 10, BuildingType.LIBRARY);
    
    // Lecture Hall (north-east)
    this.tryPlaceBuilding(cx + 3, cy - 10, BuildingType.LECTURE_HALL);
    
    // Science Center (modern, north-far-east)
    this.tryPlaceBuilding(cx + 10, cy - 8, BuildingType.SCIENCE_CENTER);
    
    // Lab (north-far-west)
    this.tryPlaceBuilding(cx - 13, cy - 8, BuildingType.LAB);
    
    // Bulletin boards near academic buildings
    this.tryPlaceBuilding(cx - 3, cy - 8, BuildingType.BULLETIN_BOARD);
    this.tryPlaceBuilding(cx + 1, cy - 8, BuildingType.BULLETIN_BOARD);

    // ========================================
    // ZONE 3: Residential Zone (South)
    // ========================================
    
    // Dormitories (cluster in south)
    const dormLocations = [
      { x: cx - 10, y: cy + 6 },
      { x: cx - 5, y: cy + 8 },
      { x: cx + 1, y: cy + 8 },
      { x: cx + 6, y: cy + 6 },
    ];
    dormLocations.forEach(loc => this.tryPlaceBuilding(loc.x, loc.y, BuildingType.DORMITORY));
    
    // Bike racks near dorms
    this.tryPlaceBuilding(cx - 8, cy + 5, BuildingType.BIKE_RACK);
    this.tryPlaceBuilding(cx + 4, cy + 5, BuildingType.BIKE_RACK);

    // ========================================
    // ZONE 4: Recreation Zone (East)
    // ========================================
    
    // Student Union
    this.tryPlaceBuilding(cx + 12, cy - 2, BuildingType.STUDENT_UNION);
    
    // Café
    this.tryPlaceBuilding(cx + 12, cy + 3, BuildingType.CAFE);
    
    // Benches near student union
    this.tryPlaceBuilding(cx + 11, cy + 1, BuildingType.PARK_BENCH);

    // ========================================
    // ZONE 5: Sports Zone (West)
    // ========================================
    
    // Stadium (large, west side)
    this.tryPlaceBuilding(cx - 16, cy - 2, BuildingType.STADIUM);
    
    // Gym (using warehouse as proxy)
    this.tryPlaceBuilding(cx - 16, cy + 5, BuildingType.WAREHOUSE);

    // ========================================
    // ZONE 6: Campus Perimeter
    // ========================================
    
    // Campus gates
    this.tryPlaceBuilding(cx - 1, cy + 12, BuildingType.CAMPUS_GATE);  // Main entrance (south)
    this.tryPlaceBuilding(cx + 15, cy - 1, BuildingType.CAMPUS_GATE);  // East entrance
    
    // Lampposts along main paths
    const lamppostLocations = [
      { x: cx - 6, y: cy + 5 },
      { x: cx + 5, y: cy + 5 },
      { x: cx - 6, y: cy - 6 },
      { x: cx + 5, y: cy - 6 },
      { x: cx, y: cy + 8 },
      { x: cx, y: cy - 6 },
    ];
    lamppostLocations.forEach(loc => this.tryPlaceBuilding(loc.x, loc.y, BuildingType.LAMPPOST));

    console.log(`Generated ${this.layer.buildings.length} buildings (University Campus Layout)`);
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
