export const JOB_SKINS = {
  // Tech Sector (Row 1)
  TECH_DEV_MALE: 0,
  TECH_DEV_FEMALE: 1,
  TECH_HACKER: 2,
  
  // Healthcare Sector (Row 1 & 2)
  HEALTH_DOC_MALE: 4,
  HEALTH_NURSE_FEMALE: 5,
  HEALTH_SURGEON: 6,

  // Services (Row 3)
  SERVICE_CHEF: 12,
  SERVICE_BARISTA: 13,
  
  // Education (Row 4)
  EDU_PROFESSOR: 18,
  EDU_TEACHER: 19
} as const;

export type JobRole = keyof typeof JOB_SKINS;
