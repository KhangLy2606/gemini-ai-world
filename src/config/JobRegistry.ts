
/**
 * Job Registry - Legacy Compatibility Layer
 * 
 * Maps job roles to character sprite indices.
 * For new code, use CharacterRegistry directly.
 * 
 * This module is kept for backward compatibility with existing code
 * that references JOB_SKINS. New code should use:
 * - getCharacterByJob() from CharacterRegistry for job-based lookups
 * - getCharacterById() from CharacterRegistry for direct lookups
 */

// Legacy frame indices (still used for reference)
export const JOB_SKINS = {
  // Tech Sector (Row 1)
  TECH_DEV_MALE: 0,
  TECH_DEV_FEMALE: 1,
  TECH_HACKER: 2,
  
  // Healthcare Sector (Row 1 & 2)
  HEALTH_DOC_MALE: 16, // Updated to match CharacterRegistry (row 1, first frame)
  HEALTH_NURSE_FEMALE: 17,
  HEALTH_SURGEON: 18,

  // Services (Row 3)
  SERVICE_CHEF: 32, // Updated to match CharacterRegistry (row 2, first frame)
  SERVICE_BARISTA: 33,
  
  // Education (Row 4)
  EDU_PROFESSOR: 48, // Updated to match CharacterRegistry (row 3, first frame)
  EDU_TEACHER: 49,

  // Creative (Row 5)
  CREATIVE_ARTIST: 64, // Updated to match CharacterRegistry (row 4, first frame)
  CREATIVE_MUSICIAN: 65
} as const;

export type JobRole = keyof typeof JOB_SKINS;

/**
 * Maps legacy job roles to CharacterRegistry IDs
 * Use this for transitioning old code to the new system
 */
export const JOB_TO_CHARACTER_ID: Record<JobRole, string> = {
  TECH_DEV_MALE: 'TECH_DEV_MALE',
  TECH_DEV_FEMALE: 'TECH_DEV_FEMALE',
  TECH_HACKER: 'TECH_HACKER',
  HEALTH_DOC_MALE: 'HEALTH_DOC_MALE',
  HEALTH_NURSE_FEMALE: 'HEALTH_NURSE_FEMALE',
  HEALTH_SURGEON: 'HEALTH_SURGEON',
  SERVICE_CHEF: 'SERVICE_CHEF',
  SERVICE_BARISTA: 'SERVICE_BARISTA',
  EDU_PROFESSOR: 'EDU_PROFESSOR',
  EDU_TEACHER: 'EDU_TEACHER',
  CREATIVE_ARTIST: 'CREATIVE_ARTIST',
  CREATIVE_MUSICIAN: 'CREATIVE_MUSICIAN',
};