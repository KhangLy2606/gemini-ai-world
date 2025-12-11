
/**
 * Character Registry System
 * 
 * Maps character IDs to their sprite assets for the single-frame character system.
 * Each character uses a single 32x32px front-facing sprite.
 */

export type CharacterCategory = 'tech' | 'health' | 'service' | 'edu' | 'creative' | 'custom';

export interface CharacterDefinition {
  id: string;
  name: string;
  category: CharacterCategory;
  spriteKey: string; // Phaser texture key
  spritePath: string; // Asset path for loading
  frameIndex: number; // Frame index in spritesheet (for multi-character sheets)
}

/**
 * Character Registry
 * 
 * Contains all available character definitions, including:
 * - Built-in characters from minions_atlas.png (each uses frame 0 of their row)
 * - Custom characters loaded from /assets/custom/
 */
export const CHARACTER_REGISTRY: Record<string, CharacterDefinition> = {
  // ============================================
  // Tech Sector Characters
  // ============================================
  TECH_DEV_MALE: {
    id: 'TECH_DEV_MALE',
    name: 'Tech Developer',
    category: 'tech',
    spriteKey: 'minions_atlas',
    spritePath: '/assets/minions_atlas.png',
    frameIndex: 0, // Row 0, first frame
  },
  TECH_DEV_FEMALE: {
    id: 'TECH_DEV_FEMALE',
    name: 'Tech Developer (F)',
    category: 'tech',
    spriteKey: 'minions_atlas',
    spritePath: '/assets/minions_atlas.png',
    frameIndex: 1,
  },
  TECH_HACKER: {
    id: 'TECH_HACKER',
    name: 'Hacker',
    category: 'tech',
    spriteKey: 'minions_atlas',
    spritePath: '/assets/minions_atlas.png',
    frameIndex: 2,
  },

  // ============================================
  // Healthcare Sector Characters
  // ============================================
  HEALTH_DOC_MALE: {
    id: 'HEALTH_DOC_MALE',
    name: 'Doctor',
    category: 'health',
    spriteKey: 'minions_atlas',
    spritePath: '/assets/minions_atlas.png',
    frameIndex: 16, // Row 1, first frame
  },
  HEALTH_NURSE_FEMALE: {
    id: 'HEALTH_NURSE_FEMALE',
    name: 'Nurse',
    category: 'health',
    spriteKey: 'minions_atlas',
    spritePath: '/assets/minions_atlas.png',
    frameIndex: 17,
  },
  HEALTH_SURGEON: {
    id: 'HEALTH_SURGEON',
    name: 'Surgeon',
    category: 'health',
    spriteKey: 'minions_atlas',
    spritePath: '/assets/minions_atlas.png',
    frameIndex: 18,
  },

  // ============================================
  // Service Sector Characters
  // ============================================
  SERVICE_CHEF: {
    id: 'SERVICE_CHEF',
    name: 'Chef',
    category: 'service',
    spriteKey: 'minions_atlas',
    spritePath: '/assets/minions_atlas.png',
    frameIndex: 32, // Row 2, first frame
  },
  SERVICE_BARISTA: {
    id: 'SERVICE_BARISTA',
    name: 'Barista',
    category: 'service',
    spriteKey: 'minions_atlas',
    spritePath: '/assets/minions_atlas.png',
    frameIndex: 33,
  },

  // ============================================
  // Education Sector Characters
  // ============================================
  EDU_PROFESSOR: {
    id: 'EDU_PROFESSOR',
    name: 'Professor',
    category: 'edu',
    spriteKey: 'minions_atlas',
    spritePath: '/assets/minions_atlas.png',
    frameIndex: 48, // Row 3, first frame
  },
  EDU_TEACHER: {
    id: 'EDU_TEACHER',
    name: 'Teacher',
    category: 'edu',
    spriteKey: 'minions_atlas',
    spritePath: '/assets/minions_atlas.png',
    frameIndex: 49,
  },

  // ============================================
  // Creative Sector Characters
  // ============================================
  CREATIVE_ARTIST: {
    id: 'CREATIVE_ARTIST',
    name: 'Artist',
    category: 'creative',
    spriteKey: 'minions_atlas',
    spritePath: '/assets/minions_atlas.png',
    frameIndex: 64, // Row 4, first frame
  },
  CREATIVE_MUSICIAN: {
    id: 'CREATIVE_MUSICIAN',
    name: 'Musician',
    category: 'creative',
    spriteKey: 'minions_atlas',
    spritePath: '/assets/minions_atlas.png',
    frameIndex: 65,
  },

  // ============================================
  // Custom Characters
  // ============================================
  SHADOW_KNIGHT: {
    id: 'SHADOW_KNIGHT',
    name: 'Shadow Knight',
    category: 'custom',
    spriteKey: 'custom_shadow_knight',
    spritePath: '/assets/custom/shadow_knight.png',
    frameIndex: 0,
  },
  BATMAN: {
    id: 'BATMAN',
    name: 'Dark Vigilante',
    category: 'custom',
    spriteKey: 'custom_batman',
    spritePath: '/assets/custom/batman.png',
    frameIndex: 0,
  },
  SAGE: {
    id: 'SAGE',
    name: 'Nature Sage',
    category: 'custom',
    spriteKey: 'custom_sage',
    spritePath: '/assets/custom/sage.png',
    frameIndex: 0,
  },
  AGENT: {
    id: 'AGENT',
    name: 'Secret Agent',
    category: 'custom',
    spriteKey: 'custom_agent',
    spritePath: '/assets/custom/agent.png',
    frameIndex: 0,
  }
};

/**
 * Get character definition by ID
 * Falls back to TECH_DEV_MALE if not found
 */
export function getCharacterById(id: string): CharacterDefinition {
  return CHARACTER_REGISTRY[id] ?? CHARACTER_REGISTRY.TECH_DEV_MALE;
}

/**
 * Get character definition by job role
 * Maps legacy job roles to character definitions
 */
export function getCharacterByJob(job: string): CharacterDefinition {
  // Direct lookup first
  if (CHARACTER_REGISTRY[job]) {
    return CHARACTER_REGISTRY[job];
  }

  // Fallback: determine category from job string and return first character of that category
  const categories: CharacterCategory[] = ['tech', 'health', 'service', 'edu', 'creative'];
  
  for (const category of categories) {
    if (job.toLowerCase().includes(category)) {
      const char = Object.values(CHARACTER_REGISTRY).find(c => c.category === category);
      if (char) return char;
    }
  }

  // Default fallback
  return CHARACTER_REGISTRY.TECH_DEV_MALE;
}

/**
 * Get all characters in a specific category
 */
export function getCharactersByCategory(category: CharacterCategory): CharacterDefinition[] {
  return Object.values(CHARACTER_REGISTRY).filter(c => c.category === category);
}

/**
 * Get all custom characters
 */
export function getCustomCharacters(): CharacterDefinition[] {
  return Object.values(CHARACTER_REGISTRY).filter(c => c.category === 'custom');
}

/**
 * Get all available character IDs
 */
export function getAllCharacterIds(): string[] {
  return Object.keys(CHARACTER_REGISTRY);
}

/**
 * Register a new custom character dynamically
 * Used for runtime character additions (e.g., from ingestion tool)
 */
export function registerCustomCharacter(character: CharacterDefinition): void {
  if (character.category !== 'custom') {
    console.warn(`Character ${character.id} is not marked as custom category`);
  }
  CHARACTER_REGISTRY[character.id] = character;
}
