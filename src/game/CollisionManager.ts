
import { EnvironmentManager } from './EnvironmentManager';

export class CollisionManager {
  private environmentManager: EnvironmentManager;
  private dynamicObstacles: Set<string> = new Set();

  constructor(environmentManager: EnvironmentManager) {
    this.environmentManager = environmentManager;
  }

  /**
   * Check if a grid position is walkable.
   * Checks both static environment obstacles and dynamic obstacles.
   */
  public isWalkable(gridX: number, gridY: number): boolean {
    // Check environment (buildings, plants)
    if (!this.environmentManager.isWalkable(gridX, gridY)) {
      return false;
    }

    // Check dynamic obstacles
    const coord = `${gridX},${gridY}`;
    if (this.dynamicObstacles.has(coord)) {
      return false;
    }

    return true;
  }

  /**
   * Check if movement from (fromX, fromY) to (toX, toY) is valid.
   * Currently only checks if destination is walkable.
   * Can be extended for path checking.
   */
  public canMoveTo(fromX: number, fromY: number, toX: number, toY: number): boolean {
    // Basic check: is destination walkable?
    return this.isWalkable(toX, toY);
  }

  /**
   * Get the full collision map as a 2D array.
   * 0 = walkable, 1 = blocked
   */
  public getCollisionMap(): number[][] {
    const staticMap = this.environmentManager.getCollisionMap();
    // Overlay dynamic obstacles
    // Note: This assumes staticMap is a copy or we can modify it, 
    // but getCollisionMap returns a new array so it's safe.
    
    for (const coord of this.dynamicObstacles) {
      const [x, y] = coord.split(',').map(Number);
      if (y >= 0 && y < staticMap.length && x >= 0 && x < staticMap[0].length) {
        staticMap[y][x] = 1;
      }
    }
    
    return staticMap;
  }

  /**
   * Update dynamic collision (e.g. temporary barriers).
   */
  public updateCollision(x: number, y: number, isBlocked: boolean): void {
    const coord = `${x},${y}`;
    if (isBlocked) {
      this.dynamicObstacles.add(coord);
    } else {
      this.dynamicObstacles.delete(coord);
    }
  }
  
  /**
   * Check if a rectangular area is free of collisions.
   */
  public isAreaFree(x: number, y: number, width: number, height: number): boolean {
    for (let dx = 0; dx < width; dx++) {
      for (let dy = 0; dy < height; dy++) {
        if (!this.isWalkable(x + dx, y + dy)) {
          return false;
        }
      }
    }
    return true;
  }
}