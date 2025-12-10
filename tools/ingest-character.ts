#!/usr/bin/env npx tsx
/**
 * Character Ingestion Tool
 * 
 * Validates and integrates custom 32x32px character sprites into the game.
 * 
 * Usage:
 *   npm run ingest:character -- --file <path> --id <ID> --category <category> --name <name>
 * 
 * Example:
 *   npm run ingest:character -- --file ./matrix-neo.png --id MATRIX_NEO --category custom --name "Matrix Neo"
 */

import * as fs from 'fs';
import * as path from 'path';

// Simple PNG dimension checker (reads PNG header)
function getPngDimensions(buffer: Buffer): { width: number; height: number } | null {
  // PNG signature: 137 80 78 71 13 10 26 10
  const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  
  if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return null; // Not a valid PNG
  }

  // IHDR chunk starts at byte 8
  // Chunk type at bytes 12-15 should be "IHDR"
  const ihdrType = buffer.subarray(12, 16).toString('ascii');
  if (ihdrType !== 'IHDR') {
    return null;
  }

  // Width is at bytes 16-19 (big-endian)
  const width = buffer.readUInt32BE(16);
  // Height is at bytes 20-23 (big-endian)
  const height = buffer.readUInt32BE(20);

  return { width, height };
}

interface IngestOptions {
  file: string;
  id: string;
  category: string;
  name: string;
}

function parseArgs(): IngestOptions | null {
  const args = process.argv.slice(2);
  const options: Partial<IngestOptions> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--file' && args[i + 1]) {
      options.file = args[++i];
    } else if (arg === '--id' && args[i + 1]) {
      options.id = args[++i];
    } else if (arg === '--category' && args[i + 1]) {
      options.category = args[++i];
    } else if (arg === '--name' && args[i + 1]) {
      options.name = args[++i];
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Character Ingestion Tool

Usage:
  npm run ingest:character -- --file <path> --id <ID> --category <category> --name <name>

Options:
  --file      Path to the PNG file (required, must be 32x32px)
  --id        Character ID in UPPER_SNAKE_CASE (required)
  --category  Category: tech, health, service, edu, creative, custom (required)
  --name      Display name for the character (required)
  --help      Show this help message

Example:
  npm run ingest:character -- --file ./matrix-neo.png --id MATRIX_NEO --category custom --name "Matrix Neo"
      `);
      return null;
    }
  }

  if (!options.file || !options.id || !options.category || !options.name) {
    console.error('Error: Missing required arguments. Use --help for usage information.');
    return null;
  }

  return options as IngestOptions;
}

async function main() {
  const options = parseArgs();
  if (!options) {
    process.exit(1);
  }

  console.log('🎮 Character Ingestion Tool');
  console.log('==========================');
  console.log(`File:     ${options.file}`);
  console.log(`ID:       ${options.id}`);
  console.log(`Category: ${options.category}`);
  console.log(`Name:     ${options.name}`);
  console.log('');

  // Validate category
  const validCategories = ['tech', 'health', 'service', 'edu', 'creative', 'custom'];
  if (!validCategories.includes(options.category)) {
    console.error(`❌ Error: Invalid category "${options.category}"`);
    console.error(`   Valid categories: ${validCategories.join(', ')}`);
    process.exit(1);
  }

  // Check if file exists
  const sourcePath = path.resolve(options.file);
  if (!fs.existsSync(sourcePath)) {
    console.error(`❌ Error: File not found: ${sourcePath}`);
    process.exit(1);
  }

  // Read and validate PNG
  const buffer = fs.readFileSync(sourcePath);
  const dimensions = getPngDimensions(buffer);

  if (!dimensions) {
    console.error('❌ Error: File is not a valid PNG image');
    process.exit(1);
  }

  console.log(`📐 Image dimensions: ${dimensions.width}x${dimensions.height}px`);

  if (dimensions.width !== 32 || dimensions.height !== 32) {
    console.error(`❌ Error: Image must be exactly 32x32 pixels`);
    console.error(`   Got: ${dimensions.width}x${dimensions.height}px`);
    process.exit(1);
  }

  console.log('✅ Image validation passed');

  // Create target directory
  const projectRoot = path.resolve(__dirname, '..');
  const customAssetsDir = path.join(projectRoot, 'public', 'assets', 'custom');
  
  if (!fs.existsSync(customAssetsDir)) {
    fs.mkdirSync(customAssetsDir, { recursive: true });
    console.log(`📁 Created directory: ${customAssetsDir}`);
  }

  // Copy file to assets
  const targetFileName = `${options.id.toLowerCase()}.png`;
  const targetPath = path.join(customAssetsDir, targetFileName);
  
  fs.copyFileSync(sourcePath, targetPath);
  console.log(`📋 Copied to: ${targetPath}`);

  // Generate registry entry
  const spriteKey = `custom_${options.id.toLowerCase()}`;
  const spritePath = `/assets/custom/${targetFileName}`;

  const registryEntry = `
  // Custom character added via ingestion tool
  ${options.id}: {
    id: '${options.id}',
    name: '${options.name}',
    category: '${options.category}' as CharacterCategory,
    spriteKey: '${spriteKey}',
    spritePath: '${spritePath}',
    frameIndex: 0,
  },`;

  console.log('');
  console.log('📝 Add this entry to CHARACTER_REGISTRY in CharacterRegistry.ts:');
  console.log('────────────────────────────────────────────────────────────────');
  console.log(registryEntry);
  console.log('────────────────────────────────────────────────────────────────');
  console.log('');

  // Also generate the preload line for MainScene
  const preloadLine = `this.load.image('${spriteKey}', '${spritePath}');`;
  
  console.log('📝 If using a custom texture key, add this to preload() in MainScene.ts:');
  console.log('────────────────────────────────────────────────────────────────');
  console.log(preloadLine);
  console.log('────────────────────────────────────────────────────────────────');
  console.log('');
  console.log('✨ Character ingestion complete!');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
