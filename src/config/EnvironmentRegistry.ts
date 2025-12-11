
// Environment Objects Registry
// Defines buildings, plants, and infrastructure for world enrichment

export enum BuildingType {
  OFFICE = 'OFFICE',
  HOUSE = 'HOUSE',
  LIBRARY = 'LIBRARY',
  HOSPITAL = 'HOSPITAL',
  CAFE = 'CAFE',
  WAREHOUSE = 'WAREHOUSE',
  LAB = 'LAB',
  PARK_BENCH = 'PARK_BENCH',
  FOUNTAIN = 'FOUNTAIN',
  STORAGE = 'STORAGE'
}

export enum PlantType {
  TREE_OAK = 'TREE_OAK',
  TREE_PINE = 'TREE_PINE',
  BUSH_SMALL = 'BUSH_SMALL',
  BUSH_LARGE = 'BUSH_LARGE',
  FLOWER_RED = 'FLOWER_RED',
  FLOWER_BLUE = 'FLOWER_BLUE',
  FLOWER_YELLOW = 'FLOWER_YELLOW',
  GRASS_PATCH = 'GRASS_PATCH',
  HEDGE = 'HEDGE',
  BAMBOO = 'BAMBOO'
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