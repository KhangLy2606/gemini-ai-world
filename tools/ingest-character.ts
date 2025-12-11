#!/usr/bin/env npx tsx

/**
 * Character Ingestion Tool
 * 
 * Validates and integrates custom 32x32px character sprites into the game.
 * 
 * Usage:
 *   npm run ingest:character -- --file <path> --id <ID> --category <category> --name <name> [--auto-resize]
 * 
 * Example:
 *   npm run ingest:character -- --file ./matrix-neo.png --id MATRIX_NEO --category custom --name "Matrix Neo" --auto-resize
 */

import * as fs from 'fs';
import * as path from 'path';
import { Buffer } from 'buffer';
import sharp from 'sharp';

// Simple PNG dimension checker (reads PNG header)
function getPngDimensions(buffer: any): { width: number; height: number } | null {
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
  autoResize: boolean;
}

function parseArgs(): IngestOptions | null {
  const args = (process as any).argv.slice(2);
  const options: Partial<IngestOptions> = { autoResize: false };

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
    } else if (arg === '--auto-resize') {
      options.autoResize = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Character Ingestion Tool

Usage:
  npm run ingest:character -- --file <path> --id <ID> --category <category> --name <name> [--auto-resize]

Options:
  --file        Path to the image file (required; PNG preferred)
  --id          Character ID in UPPER_SNAKE_CASE (required)
  --category    Category: tech, health, service, edu, creative, custom (required)
  --name        Display name for the character (required)
  --auto-resize Automatically resize to 32x32 with nearest-neighbor if needed
  --help        Show this help message

Example:
  npm run ingest:character -- --file ./matrix-neo.png --id MATRIX_NEO --category custom --name "Matrix Neo" --auto-resize
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

async function prepareImage(sourcePath: string, autoResize: boolean): Promise<{ buffer: Buffer; dimensions: { width: number; height: number }; originalSize: string; }> {
  const resolvedPath = path.resolve(sourcePath);

  if (!fs.existsSync(resolvedPath)) {
    console.error(`❌ Error: File not found: ${resolvedPath}`);
    (process as any).exit(1);
  }

  let metadata;
  try {
    metadata = await sharp(resolvedPath, { limitInputPixels: 4096 * 4096 }).metadata();
  } catch (error) {
    console.error('❌ Error: Unable to read image metadata. Make sure the file is a valid image.');
    (process as any).exit(1);
  }

  const originalWidth = metadata.width || 0;
  const originalHeight = metadata.height || 0;
  const originalSize = `${originalWidth}x${originalHeight}px`;

  if (!originalWidth || !originalHeight) {
    console.error('❌ Error: Unable to determine image dimensions.');
    (process as any).exit(1);
  }

  let pipeline = sharp(resolvedPath).ensureAlpha();

  const needsResize = originalWidth !== 32 || originalHeight !== 32;
  if (needsResize && !autoResize) {
    console.error(`❌ Error: Image must be exactly 32x32 pixels. Got: ${originalSize}`);
    console.error('   Tip: re-run with --auto-resize to automatically resize using nearest-neighbor.');
    (process as any).exit(1);
  }

  if (needsResize) {
    console.log(`🔧 Auto-resizing image from ${originalSize} -> 32x32 (nearest-neighbor, transparent padding)...`);
    pipeline = pipeline.resize(32, 32, {
      fit: 'contain',
      position: 'centre',
      kernel: sharp.kernel.nearest,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    });
  }

  const outputBuffer = await pipeline
    .png({ compressionLevel: 9 })
    .toBuffer();

  const finalDimensions = getPngDimensions(outputBuffer);
  if (!finalDimensions) {
    console.error('❌ Error: Processed file is not a valid PNG image.');
    (process as any).exit(1);
  }

  if (finalDimensions.width !== 32 || finalDimensions.height !== 32) {
    console.error(`❌ Error: Processed image must be 32x32px. Got: ${finalDimensions.width}x${finalDimensions.height}px`);
    (process as any).exit(1);
  }

  return { buffer: outputBuffer, dimensions: finalDimensions, originalSize };
}

async function main() {
  const options = parseArgs();
  if (!options) {
    (process as any).exit(1);
  }

  console.log('🎮 Character Ingestion Tool');
  console.log('==========================');
  console.log(`File:     ${options.file}`);
  console.log(`ID:       ${options.id}`);
  console.log(`Category: ${options.category}`);
  console.log(`Name:     ${options.name}`);
  console.log(`AutoResize: ${options.autoResize ? 'enabled' : 'disabled'}`);
  console.log('');

  // Validate category
  const validCategories = ['tech', 'health', 'service', 'edu', 'creative', 'custom'];
  if (!validCategories.includes(options.category)) {
    console.error(`❌ Error: Invalid category "${options.category}"`);
    console.error(`   Valid categories: ${validCategories.join(', ')}`);
    (process as any).exit(1);
  }

  const { buffer, dimensions, originalSize } = await prepareImage(options.file, options.autoResize);
  console.log(`📐 Image dimensions: ${dimensions.width}x${dimensions.height}px (source was ${originalSize})`);
  console.log('✅ Image validation passed');

  // Create target directory
  const projectRoot = (process as any).cwd();
  const customAssetsDir = path.join(projectRoot, 'public', 'assets', 'custom');
  
  if (!fs.existsSync(customAssetsDir)) {
    fs.mkdirSync(customAssetsDir, { recursive: true });
    console.log(`📁 Created directory: ${customAssetsDir}`);
  }

  // Copy file to assets
  const targetFileName = `${options.id.toLowerCase()}.png`;
  const targetPath = path.join(customAssetsDir, targetFileName);
  
  fs.writeFileSync(targetPath, buffer);
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
  (process as any).exit(1);
});
