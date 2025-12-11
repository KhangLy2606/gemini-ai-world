
// Campus Theme Color Palette
// Unified colors for the university campus aesthetic

export const CAMPUS_PALETTE = {
  // Gothic Stone
  STONE_LIGHT: 0xD4C4A8,
  STONE_DARK: 0x8B7355,
  STONE_ACCENT: 0x6B5344,
  
  // Brick
  BRICK_RED: 0xA0522D,
  BRICK_MORTAR: 0xD2B48C,
  
  // Roofs
  SLATE_GRAY: 0x708090,
  COPPER_GREEN: 0x2E8B57,
  
  // Foliage (Autumn)
  TREE_ORANGE: 0xD2691E,
  TREE_RED: 0xB22222,
  TREE_GOLD: 0xDAA520,
  TREE_GREEN: 0x228B22,
  
  // Paths
  COBBLESTONE: 0xA9A9A9,
  PATHWAY_LIGHT: 0xC4B896,
  PATHWAY_DARK: 0x8B8B7A,
  
  // Accents
  BANNER_CRIMSON: 0xDC143C,
  BANNER_GOLD: 0xFFD700,
  FOUNTAIN_WATER: 0x4169E1,
  
  // Windows
  WINDOW_LIT: 0xFFEB3B,
  WINDOW_DARK: 0x333333,
  
  // Iron/Metal
  IRON_DARK: 0x2F4F4F,
  IRON_LIGHT: 0x4682B4,
};

// Season-specific color adjustments
export const AUTUMN_GROUND_TINT = 0x8B7355;
export const AUTUMN_LEAF_SCATTER = [0xD2691E, 0xB22222, 0xDAA520, 0x8B4513];

// Architecture style hints
export enum ArchitectureStyle {
  GOTHIC = 'GOTHIC',       // Pointed arches, buttresses, spires
  GEORGIAN = 'GEORGIAN',   // Symmetrical, brick, white trim
  MODERN = 'MODERN',       // Glass, steel, clean lines
}

export const BUILDING_STYLE_MAP: Record<string, ArchitectureStyle> = {
  CLOCK_TOWER: ArchitectureStyle.GOTHIC,
  LECTURE_HALL: ArchitectureStyle.GEORGIAN,
  LIBRARY: ArchitectureStyle.GOTHIC,
  DORMITORY: ArchitectureStyle.GEORGIAN,
  STUDENT_UNION: ArchitectureStyle.GOTHIC,
  SCIENCE_CENTER: ArchitectureStyle.MODERN,
  LAB: ArchitectureStyle.MODERN,
  STADIUM: ArchitectureStyle.MODERN,
};
