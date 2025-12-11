
// Environment Objects Registry
// Defines buildings, plants, and infrastructure for world enrichment

export enum BuildingType {
  // Original types
  OFFICE = 'OFFICE',
  HOUSE = 'HOUSE',
  LIBRARY = 'LIBRARY',
  HOSPITAL = 'HOSPITAL',
  CAFE = 'CAFE',
  WAREHOUSE = 'WAREHOUSE',
  LAB = 'LAB',
  PARK_BENCH = 'PARK_BENCH',
  FOUNTAIN = 'FOUNTAIN',
  STORAGE = 'STORAGE',
  
  // University Campus Buildings
  CLOCK_TOWER = 'CLOCK_TOWER',
  LECTURE_HALL = 'LECTURE_HALL',
  STUDENT_UNION = 'STUDENT_UNION',
  DORMITORY = 'DORMITORY',
  STADIUM = 'STADIUM',
  SCIENCE_CENTER = 'SCIENCE_CENTER',
  
  // Campus Props
  STATUE = 'STATUE',
  LAMPPOST = 'LAMPPOST',
  BIKE_RACK = 'BIKE_RACK',
  BULLETIN_BOARD = 'BULLETIN_BOARD',
  CAMPUS_GATE = 'CAMPUS_GATE'
}

export enum PlantType {
  // Original types
  TREE_OAK = 'TREE_OAK',
  TREE_PINE = 'TREE_PINE',
  BUSH_SMALL = 'BUSH_SMALL',
  BUSH_LARGE = 'BUSH_LARGE',
  FLOWER_RED = 'FLOWER_RED',
  FLOWER_BLUE = 'FLOWER_BLUE',
  FLOWER_YELLOW = 'FLOWER_YELLOW',
  GRASS_PATCH = 'GRASS_PATCH',
  HEDGE = 'HEDGE',
  BAMBOO = 'BAMBOO',
  
  // University Campus Plants (Autumn Theme)
  TREE_AUTUMN = 'TREE_AUTUMN',
  TREE_MAPLE = 'TREE_MAPLE',
  HEDGE_TRIMMED = 'HEDGE_TRIMMED',
  FLOWER_BED = 'FLOWER_BED',
  IVY_WALL = 'IVY_WALL'
}

export interface BuildingConfig {
  width: number;  // in tiles
  height: number; // in tiles
  color: number;  // hex color
  roofColor?: number;
  isPassable: boolean;
  occupyLand: boolean; // if true, plants won't spawn here
}

export interface PlantConfig {
  width: number;  // in tiles
  height: number; // in tiles
  color: number;  // hex color
  leafColor?: number;
  canWalkThrough: boolean;
  density: 'low' | 'medium' | 'high'; // spawning frequency
}

// Building Registry
export const BUILDINGS: Record<BuildingType, BuildingConfig> = {
  [BuildingType.OFFICE]: {
    width: 4,
    height: 4,
    color: 0x556b82,
    roofColor: 0x8b5a3c,
    isPassable: false,
    occupyLand: true
  },
  [BuildingType.HOUSE]: {
    width: 3,
    height: 3,
    color: 0xa0745d,
    roofColor: 0x6b4423,
    isPassable: false,
    occupyLand: true
  },
  [BuildingType.LIBRARY]: {
    width: 5,
    height: 3,
    color: 0x4a5859,
    roofColor: 0x2d3436,
    isPassable: false,
    occupyLand: true
  },
  [BuildingType.HOSPITAL]: {
    width: 6,
    height: 4,
    color: 0xf0f0f0,
    roofColor: 0xff6b6b,
    isPassable: false,
    occupyLand: true
  },
  [BuildingType.CAFE]: {
    width: 3,
    height: 2,
    color: 0xd4a574,
    roofColor: 0x8b4513,
    isPassable: false,
    occupyLand: true
  },
  [BuildingType.WAREHOUSE]: {
    width: 5,
    height: 5,
    color: 0x696969,
    roofColor: 0x404040,
    isPassable: false,
    occupyLand: true
  },
  [BuildingType.LAB]: {
    width: 4,
    height: 3,
    color: 0x4a90e2,
    roofColor: 0x2b5aa0,
    isPassable: false,
    occupyLand: true
  },
  [BuildingType.PARK_BENCH]: {
    width: 1,
    height: 1,
    color: 0x8b6f47,
    isPassable: true,
    occupyLand: false
  },
  [BuildingType.FOUNTAIN]: {
    width: 2,
    height: 2,
    color: 0x4db8ff,
    roofColor: 0xc0c0c0,
    isPassable: true,
    occupyLand: false
  },
  [BuildingType.STORAGE]: {
    width: 3,
    height: 3,
    color: 0x5a4a3a,
    roofColor: 0x3a2a1a,
    isPassable: false,
    occupyLand: true
  },
  
  // University Campus Buildings
  [BuildingType.CLOCK_TOWER]: {
    width: 3,
    height: 5,
    color: 0xD4C4A8,  // Gothic stone
    roofColor: 0x708090, // Slate gray
    isPassable: false,
    occupyLand: true
  },
  [BuildingType.LECTURE_HALL]: {
    width: 6,
    height: 4,
    color: 0xA0522D,  // Brick red
    roofColor: 0x708090, // Slate
    isPassable: false,
    occupyLand: true
  },
  [BuildingType.STUDENT_UNION]: {
    width: 5,
    height: 3,
    color: 0xD4C4A8,  // Stone
    roofColor: 0x2E8B57, // Copper green
    isPassable: false,
    occupyLand: true
  },
  [BuildingType.DORMITORY]: {
    width: 4,
    height: 5,
    color: 0xA0522D,  // Brick
    roofColor: 0x708090, // Slate
    isPassable: false,
    occupyLand: true
  },
  [BuildingType.STADIUM]: {
    width: 8,
    height: 6,
    color: 0x8B7355,  // Dark stone
    roofColor: 0x404040,
    isPassable: false,
    occupyLand: true
  },
  [BuildingType.SCIENCE_CENTER]: {
    width: 5,
    height: 4,
    color: 0xB0C4DE,  // Light steel blue (modern glass)
    roofColor: 0x708090,
    isPassable: false,
    occupyLand: true
  },
  
  // Campus Props
  [BuildingType.STATUE]: {
    width: 1,
    height: 1,
    color: 0x708090,  // Stone gray
    isPassable: true,
    occupyLand: false
  },
  [BuildingType.LAMPPOST]: {
    width: 1,
    height: 1,
    color: 0x2F4F4F,  // Dark slate
    isPassable: true,
    occupyLand: false
  },
  [BuildingType.BIKE_RACK]: {
    width: 2,
    height: 1,
    color: 0x4682B4,  // Steel blue
    isPassable: true,
    occupyLand: false
  },
  [BuildingType.BULLETIN_BOARD]: {
    width: 1,
    height: 1,
    color: 0x8B4513,  // Wood brown
    isPassable: true,
    occupyLand: false
  },
  [BuildingType.CAMPUS_GATE]: {
    width: 3,
    height: 2,
    color: 0x2F4F4F,  // Dark iron
    roofColor: 0xFFD700, // Gold accent
    isPassable: true,
    occupyLand: false
  }
};

// Plant Registry
export const PLANTS: Record<PlantType, PlantConfig> = {
  [PlantType.TREE_OAK]: {
    width: 2,
    height: 2,
    color: 0x228b22,
    leafColor: 0x32cd32,
    canWalkThrough: false,
    density: 'low'
  },
  [PlantType.TREE_PINE]: {
    width: 2,
    height: 2,
    color: 0x0b6623,
    leafColor: 0x2d5a27,
    canWalkThrough: false,
    density: 'low'
  },
  [PlantType.BUSH_SMALL]: {
    width: 1,
    height: 1,
    color: 0x3a7d44,
    leafColor: 0x52b788,
    canWalkThrough: true,
    density: 'high'
  },
  [PlantType.BUSH_LARGE]: {
    width: 2,
    height: 1,
    color: 0x2d6a4f,
    leafColor: 0x40916c,
    canWalkThrough: false,
    density: 'medium'
  },
  [PlantType.FLOWER_RED]: {
    width: 1,
    height: 1,
    color: 0xff6b6b,
    leafColor: 0x27ae60,
    canWalkThrough: true,
    density: 'high'
  },
  [PlantType.FLOWER_BLUE]: {
    width: 1,
    height: 1,
    color: 0x4db8ff,
    leafColor: 0x27ae60,
    canWalkThrough: true,
    density: 'high'
  },
  [PlantType.FLOWER_YELLOW]: {
    width: 1,
    height: 1,
    color: 0xffd93d,
    leafColor: 0x27ae60,
    canWalkThrough: true,
    density: 'high'
  },
  [PlantType.GRASS_PATCH]: {
    width: 1,
    height: 1,
    color: 0x52b788,
    leafColor: 0x74c69d,
    canWalkThrough: true,
    density: 'high'
  },
  [PlantType.HEDGE]: {
    width: 3,
    height: 1,
    color: 0x2d5a27,
    leafColor: 0x40916c,
    canWalkThrough: false,
    density: 'medium'
  },
  [PlantType.BAMBOO]: {
    width: 1,
    height: 2,
    color: 0x52b788,
    leafColor: 0x95d5b2,
    canWalkThrough: true,
    density: 'low'
  },
  
  // University Campus Plants (Autumn Theme)
  [PlantType.TREE_AUTUMN]: {
    width: 2,
    height: 2,
    color: 0xD2691E,  // Orange
    leafColor: 0xB22222, // Red accent
    canWalkThrough: false,
    density: 'low'
  },
  [PlantType.TREE_MAPLE]: {
    width: 2,
    height: 2,
    color: 0xDAA520,  // Gold
    leafColor: 0xD2691E, // Orange
    canWalkThrough: false,
    density: 'low'
  },
  [PlantType.HEDGE_TRIMMED]: {
    width: 2,
    height: 1,
    color: 0x2E8B57,  // Sea green (manicured)
    leafColor: 0x3CB371,
    canWalkThrough: false,
    density: 'medium'
  },
  [PlantType.FLOWER_BED]: {
    width: 2,
    height: 1,
    color: 0xDC143C,  // Crimson
    leafColor: 0xFFD700, // Gold
    canWalkThrough: true,
    density: 'medium'
  },
  [PlantType.IVY_WALL]: {
    width: 1,
    height: 2,
    color: 0x228B22,  // Forest green
    leafColor: 0x006400, // Dark green
    canWalkThrough: true,
    density: 'low'
  }
};

// Helper functions
export function getRandomBuilding(): BuildingType {
  const types = Object.values(BuildingType);
  return types[Math.floor(Math.random() * types.length)];
}

export function getRandomPlant(): PlantType {
  const types = Object.values(PlantType);
  return types[Math.floor(Math.random() * types.length)];
}

export function getPlantsByDensity(density: 'low' | 'medium' | 'high'): PlantType[] {
  return Object.entries(PLANTS)
    .filter(([_, config]) => config.density === density)
    .map(([type]) => type as PlantType);
}