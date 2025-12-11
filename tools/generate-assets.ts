import { GoogleGenAI } from "@google/genai";
import * as fs from 'fs';
import * as path from 'path';
import { Buffer } from 'buffer';

declare var process: any;

// Helper to load .env.local
function loadEnv() {
  try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      content.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          const value = match[2].trim().replace(/^["']|["']$/g, '');
          process.env[key] = value;
        }
      });
      console.log("✅ Loaded environment variables from .env.local");
    }
  } catch (e) {
    console.warn("⚠️ Could not load .env.local, relying on system environment variables.");
  }
}

loadEnv();

// Asset Definitions provided by user
const ASSETS_TO_GENERATE = [
  {
    key: "grass_tileset",
    filename: "grass_tileset.png",
    prompt: "Subject: A complete pixel art sprite sheet texture atlas of grass terrain tiles filling the entire 1024x1024 image. This is a full texture atlas with no whitespace - tiles fill the canvas.\n\nStyle: Flat 2D Pixel Art, 16-bit SNES-era RPG style (like Stardew Valley). Vibrant colors, crisp pixels, chunky pixel art blocks.\n\nLayout: The entire 1024x1024 canvas is divided into a strict 2x3 grid (2 columns, 3 rows). Each grid cell contains one unique grass tile variation. The tiles are large, chunky pixel art blocks that fill their grid cells completely. No whitespace between tiles - they touch edge-to-edge.\n\nGrid Structure:\n- Column 1 (left half of canvas): Contains 3 tiles stacked vertically\n- Column 2 (right half of canvas): Contains 3 tiles stacked vertically\n- Total: 6 unique grass tile variations\n- Each tile fills exactly half the canvas width (512px) and one-third the canvas height (341px)\n- Tiles are large, visible, chunky pixel art blocks - not tiny sprites\n\nContent - Each Grid Cell:\n- Top-left cell (Column 1, Row 1): Plain grass tile with uniform green coverage, smooth texture\n- Top-right cell (Column 2, Row 1): Grass with small tufts and texture variation, natural clumping\n- Middle-left cell (Column 1, Row 2): Grass with tiny white/yellow flowers scattered, dandelion-like\n- Middle-right cell (Column 2, Row 2): Grass with dirt patches and brown earth showing through, worn areas\n- Bottom-left cell (Column 1, Row 3): Grass with clover patches and small decorative elements, three-leaf clovers\n- Bottom-right cell (Column 2, Row 3): Grass with mixed vegetation and natural variation, organic randomness\n\nColor Palette (8 colors maximum):\n- #2d5a27 (dark green base)\n- #35682d (medium green)\n- #52b788 (bright green highlights)\n- #8b6f47 (brown dirt)\n- #6b5a3a (dark brown)\n- #ffd700 (yellow flowers)\n- #ffaa00 (orange flowers)\n- #ffffff (white flowers)\n\nVisual Requirements:\n- Top-down perspective (viewed from above)\n- No anti-aliasing, crisp pixel edges\n- Chunky, visible pixel art style - tiles should be clearly defined blocks\n- Each tile should tile seamlessly when placed next to each other (edges match)\n- No shadows cast on the ground\n- Tiles fill their grid cells completely - no gaps or borders\n- The entire canvas is filled with tiles - no background whitespace\n\nTechnical Notes:\n- Canvas: 1024x1024 pixels\n- Grid: 2 columns × 3 rows = 6 tiles\n- Each tile occupies approximately 512px wide × 341px tall (will be resized to 32x32px in post-processing)\n- This is a texture atlas - tiles are generated large for quality, then downscaled to game size\n\nConstraints:\n- The entire image must be filled with tiles - no white background\n- Tiles must be clearly separated by grid boundaries (visual separation, not white space)\n- Each tile variation must be distinct and recognizable\n- Pixel art style must be consistent across all tiles\n- Colors must stay within the 8-color palette\n- Final canvas: 1024x1024 pixels, 1:1 aspect ratio"
  },
  {
    key: "path_tileset",
    filename: "path_tileset.png",
    prompt: "Subject: A complete pixel art sprite sheet texture atlas of dirt and paved path tiles filling the entire 1024x1024 image. This is a full texture atlas with no whitespace - tiles fill the canvas.\n\nStyle: Flat 2D Pixel Art, 16-bit SNES-era RPG style (like Stardew Valley). Earthy tones, crisp pixels, chunky pixel art blocks.\n\nLayout: The entire 1024x1024 canvas is divided into a strict 2x4 grid (2 columns, 4 rows). Each grid cell contains one unique path tile variation. The tiles are large, chunky pixel art blocks that fill their grid cells completely. No whitespace between tiles - they touch edge-to-edge.\n\nGrid Structure:\n- Column 1 (left half of canvas): Contains 4 tiles stacked vertically\n- Column 2 (right half of canvas): Contains 4 tiles stacked vertically\n- Total: 8 unique path tile variations\n- Each tile fills exactly half the canvas width (512px) and one-quarter the canvas height (256px)\n- Tiles are large, visible, chunky pixel art blocks - not tiny sprites\n\nContent - Each Grid Cell:\n- Row 1, Column 1 (top-left): Plain dirt path tile, uniform brown\n- Row 1, Column 2 (top-right): Dirt path with small stones and pebbles\n- Row 2, Column 1 (middle-left): Dirt path with footprints and texture\n- Row 2, Column 2 (middle-right): Paved stone path, gray cobblestone pattern\n- Row 3, Column 1 (middle-left): Paved brick path, red/orange brick pattern\n- Row 3, Column 2 (middle-right): Dirt path with grass edges encroaching\n- Row 4, Column 1 (bottom-left): Worn dirt path with patches\n- Row 4, Column 2 (bottom-right): Smooth paved path, modern concrete style\n\nColor Palette (6 colors maximum):\n- #8b8b7a (gray stone)\n- #a9a67e (tan dirt)\n- #6b6b5a (dark gray)\n- #8b6f47 (brown dirt)\n- #c4a484 (light brown)\n- #4a4a3a (dark stone)\n\nVisual Requirements:\n- Top-down perspective (viewed from above)\n- No anti-aliasing, crisp pixel edges\n- Chunky, visible pixel art style - tiles should be clearly defined blocks\n- Each tile should tile seamlessly when placed next to each other (edges match)\n- No shadows cast on the ground\n- Tiles fill their grid cells completely - no gaps or borders\n- The entire canvas is filled with tiles - no background whitespace\n\nTechnical Notes:\n- Canvas: 1024x1024 pixels\n- Grid: 2 columns × 4 rows = 8 tiles\n- Each tile occupies approximately 512px wide × 256px tall (will be resized to 32x32px in post-processing)\n- This is a texture atlas - tiles are generated large for quality, then downscaled to game size\n\nConstraints:\n- The entire image must be filled with tiles - no white background\n- Tiles must be clearly separated by grid boundaries (visual separation, not white space)\n- Each tile variation must be distinct and recognizable\n- Pixel art style must be consistent across all tiles\n- Colors must stay within the 6-color palette\n- Final canvas: 1024x1024 pixels, 1:1 aspect ratio"
  },
  {
    key: "building-OFFICE",
    filename: "building-office.png",
    prompt: "Subject: A pixel art Tech Office building for a top-down game world.\nStyle: Flat 2D Pixel Art, 16-bit SNES-era RPG style (like Stardew Valley). Modern glass/steel aesthetic, pixelated.\nDimensions: 128x128 pixels (4x4 tiles at 32px per tile)\nContent:\n- Modern office building with glass windows\n- Steel frame structure visible\n- Rectangular shape, 4 tiles wide by 4 tiles tall (128x128 pixels)\n- Multiple windows arranged in a grid pattern\n- Modern architectural style with clean lines\n- Entrance visible on one side\n- Rooftop details (AC units, antennas, or modern roof)\nColor Palette (10 colors maximum):\n- #556b82 (main building color - blue-gray)\n- #8b5a3c (roof color - brown)\n- #4a90e2 (glass/window blue)\n- #2d3436 (shadows, dark details)\n- #f0f0f0 (highlights, window reflections)\n- #6b7a8c (medium gray details)\n- #3a4a5a (dark gray accents)\n- #ffffff (bright window highlights)\n- #c0c0c0 (metal accents)\n- #1a1a1a (deep shadows)\nConstraints:\n- Solid white background (#FFFFFF)\n- Top-down perspective (viewed from above)\n- No anti-aliasing, crisp pixel edges\n- CRITICAL: Canvas must be exactly 128 pixels wide and 128 pixels tall\n- CRITICAL: Building must fit within the 128x128 pixel area\n- No shadows cast on the ground\n- Building should look like a modern tech office\n- Consistent pixel art style"
  },
  {
    key: "building-HOSPITAL",
    filename: "building-hospital.png",
    prompt: "Subject: A pixel art Hospital building for a top-down game world.\nStyle: Flat 2D Pixel Art, 16-bit SNES-era RPG style (like Stardew Valley). Clean medical aesthetic.\nDimensions: 192x128 pixels (6x4 tiles at 32px per tile)\nContent:\n- White hospital building\n- Large red cross symbol prominently displayed\n- Rectangular shape, 6 tiles wide by 4 tiles tall (192x128 pixels)\n- Multiple windows arranged regularly\n- Clean, sterile appearance\n- Entrance with medical cross symbol\n- Rooftop with medical equipment or helipad area\n- Red cross on roof or side wall\nColor Palette (10 colors maximum):\n- #f0f0f0 (main building color - white)\n- #ff6b6b (roof/cross color - red)\n- #e0e0e0 (walls - light gray)\n- #2d3436 (shadows, dark details)\n- #ffffff (highlights, bright white)\n- #cc5555 (red details, cross)\n- #8b8b8b (gray details)\n- #c0c0c0 (accents, window frames)\n- #ff9999 (light red highlights)\n- #1a1a1a (deep shadows)\nConstraints:\n- Solid white background (#FFFFFF)\n- Top-down perspective (viewed from above)\n- No anti-aliasing, crisp pixel edges\n- CRITICAL: Canvas must be exactly 192 pixels wide and 128 pixels tall\n- CRITICAL: Building must fit within the 192x128 pixel area\n- No shadows cast on the ground\n- Red cross must be clearly visible\n- Building should look like a medical facility\n- Consistent pixel art style"
  },
  {
    key: "building-CAFE",
    filename: "building-cafe.png",
    prompt: "Subject: A pixel art Cafe building for a top-down game world.\nStyle: Flat 2D Pixel Art, 16-bit SNES-era RPG style (like Stardew Valley). Cozy, welcoming aesthetic.\nDimensions: 96x64 pixels (3x2 tiles at 32px per tile)\nContent:\n- Brick building with awning\n- Rectangular shape, 3 tiles wide by 2 tiles tall (96x64 pixels)\n- Colorful awning extending over entrance\n- Windows showing cafe interior\n- Chimney or vent on roof\n- Outdoor seating area visible\n- Warm, inviting appearance\n- Sign or cafe name visible\nColor Palette (10 colors maximum):\n- #d4a574 (main building color - brick/tan)\n- #8b4513 (roof color - brown)\n- #a0745d (brick texture)\n- #2d3436 (shadows, dark details)\n- #f0f0f0 (highlights, awning)\n- #ff6b6b (red awning accents)\n- #8b6f47 (wooden details)\n- #c4a484 (light brick)\n- #ffffff (window highlights)\n- #1a1a1a (deep shadows)\nConstraints:\n- Solid white background (#FFFFFF)\n- Top-down perspective (viewed from above)\n- No anti-aliasing, crisp pixel edges\n- CRITICAL: Canvas must be exactly 96 pixels wide and 64 pixels tall\n- CRITICAL: Building must fit within the 96x64 pixel area\n- No shadows cast on the ground\n- Awning should be colorful and prominent\n- Building should look like a cozy cafe\n- Consistent pixel art style"
  },
  {
    key: "building-LIBRARY",
    filename: "building-library.png",
    prompt: "Subject: A pixel art Library building for a top-down game world.\nStyle: Flat 2D Pixel Art, 16-bit SNES-era RPG style (like Stardew Valley). Classic, scholarly aesthetic.\nDimensions: 160x96 pixels (5x3 tiles at 32px per tile)\nContent:\n- Classic library building with columns\n- Rectangular shape, 5 tiles wide by 3 tiles tall (160x96 pixels)\n- Columns or pillars at entrance\n- Large windows showing bookshelves\n- Traditional architectural style\n- Entrance with steps\n- Rooftop with decorative elements\n- Scholarly, academic appearance\nColor Palette (10 colors maximum):\n- #4a5859 (main building color - gray-green)\n- #2d3436 (roof color - dark gray)\n- #6b7a8c (column color)\n- #2d3436 (shadows, dark details)\n- #f0f0f0 (highlights, columns)\n- #8b8b8b (gray details)\n- #5a6a7a (medium gray)\n- #ffffff (window highlights)\n- #c0c0c0 (stone accents)\n- #1a1a1a (deep shadows)\nConstraints:\n- Solid white background (#FFFFFF)\n- Top-down perspective (viewed from above)\n- No anti-aliasing, crisp pixel edges\n- CRITICAL: Canvas must be exactly 160 pixels wide and 96 pixels tall\n- CRITICAL: Building must fit within the 160x96 pixel area\n- No shadows cast on the ground\n- Columns should be clearly visible\n- Building should look like a classic library\n- Consistent pixel art style"
  },
  {
    key: "building-LAB",
    filename: "building-lab.png",
    prompt: "Subject: A pixel art Laboratory building for a top-down game world.\nStyle: Flat 2D Pixel Art, 16-bit SNES-era RPG style (like Stardew Valley). Modern scientific aesthetic.\nDimensions: 128x96 pixels (4x3 tiles at 32px per tile)\nContent:\n- Modern laboratory building\n- Rectangular shape, 4 tiles wide by 3 tiles tall (128x96 pixels)\n- Test tubes and scientific equipment visible\n- Windows showing lab interior\n- Modern architectural style\n- Entrance with scientific symbols\n- Rooftop with vents or equipment\n- Clean, high-tech appearance\nColor Palette (10 colors maximum):\n- #4a90e2 (main building color - blue)\n- #2b5aa0 (roof color - dark blue)\n- #6ba3d4 (window color)\n- #2d3436 (shadows, dark details)\n- #f0f0f0 (highlights, white details)\n- #8b8b8b (gray details)\n- #3a7ac4 (medium blue)\n- #ffffff (bright highlights)\n- #c0c0c0 (metal accents)\n- #1a1a1a (deep shadows)\nConstraints:\n- Solid white background (#FFFFFF)\n- Top-down perspective (viewed from above)\n- No anti-aliasing, crisp pixel edges\n- CRITICAL: Canvas must be exactly 128 pixels wide and 96 pixels tall\n- CRITICAL: Building must fit within the 128x96 pixel area\n- No shadows cast on the ground\n- Scientific equipment should be visible\n- Building should look like a modern lab\n- Consistent pixel art style"
  },
  {
    key: "building-WAREHOUSE",
    filename: "building-warehouse.png",
    prompt: "Subject: A pixel art Warehouse building for a top-down game world.\nStyle: Flat 2D Pixel Art, 16-bit SNES-era RPG style (like Stardew Valley). Industrial, utilitarian aesthetic.\nDimensions: 160x160 pixels (5x5 tiles at 32px per tile)\nContent:\n- Large warehouse building\n- Square shape, 5 tiles wide by 5 tiles tall (160x160 pixels)\n- Industrial appearance with large doors\n- Windows high up on walls\n- Rooftop with vents and industrial equipment\n- Loading bay or large entrance\n- Utilitarian, functional design\n- Gray/industrial color scheme\nColor Palette (10 colors maximum):\n- #696969 (main building color - gray)\n- #404040 (roof color - dark gray)\n- #8b8b8b (wall details)\n- #2d3436 (shadows, dark details)\n- #f0f0f0 (highlights, metal)\n- #5a5a5a (medium gray)\n- #3a3a3a (dark gray)\n- #ffffff (bright highlights)\n- #c0c0c0 (metal accents)\n- #1a1a1a (deep shadows)\nConstraints:\n- Solid white background (#FFFFFF)\n- Top-down perspective (viewed from above)\n- No anti-aliasing, crisp pixel edges\n- CRITICAL: Canvas must be exactly 160 pixels wide and 160 pixels tall\n- CRITICAL: Building must fit within the 160x160 pixel area\n- No shadows cast on the ground\n- Large doors should be visible\n- Building should look like an industrial warehouse\n- Consistent pixel art style"
  },
  {
    key: "building-HOUSE",
    filename: "building-house.png",
    prompt: "Subject: A pixel art House building for a top-down game world.\nStyle: Flat 2D Pixel Art, 16-bit SNES-era RPG style (like Stardew Valley). Cozy, residential aesthetic.\nDimensions: 96x96 pixels (3x3 tiles at 32px per tile)\nContent:\n- Cozy residential house\n- Square shape, 3 tiles wide by 3 tiles tall (96x96 pixels)\n- Traditional house design with roof\n- Windows on sides\n- Front door\n- Chimney on roof\n- Warm, homey appearance\n- Residential neighborhood style\nColor Palette (10 colors maximum):\n- #a0745d (main building color - tan/brown)\n- #6b4423 (roof color - dark brown)\n- #8b6f47 (wood details)\n- #2d3436 (shadows, dark details)\n- #f0f0f0 (highlights, windows)\n- #c4a484 (light brown)\n- #5a4a3a (dark brown)\n- #ffffff (window highlights)\n- #d4a574 (roof highlights)\n- #1a1a1a (deep shadows)\nConstraints:\n- Solid white background (#FFFFFF)\n- Top-down perspective (viewed from above)\n- No anti-aliasing, crisp pixel edges\n- CRITICAL: Canvas must be exactly 96 pixels wide and 96 pixels tall\n- CRITICAL: Building must fit within the 96x96 pixel area\n- No shadows cast on the ground\n- Chimney should be visible\n- Building should look like a cozy house\n- Consistent pixel art style"
  },
  {
    key: "building-STORAGE",
    filename: "building-storage.png",
    prompt: "Subject: A pixel art Storage building for a top-down game world.\nStyle: Flat 2D Pixel Art, 16-bit SNES-era RPG style (like Stardew Valley). Simple, functional aesthetic.\nDimensions: 96x96 pixels (3x3 tiles at 32px per tile)\nContent:\n- Simple storage building\n- Square shape, 3 tiles wide by 3 tiles tall (96x96 pixels)\n- Small shed or storage structure\n- Simple door\n- Basic roof design\n- Utilitarian appearance\n- Wooden or metal construction\n- Compact design\nColor Palette (10 colors maximum):\n- #5a4a3a (main building color - brown)\n- #3a2a1a (roof color - dark brown)\n- #8b6f47 (wood details)\n- #2d3436 (shadows, dark details)\n- #f0f0f0 (highlights)\n- #6b5a4a (medium brown)\n- #4a3a2a (dark brown)\n- #ffffff (bright highlights)\n- #c0c0c0 (metal accents)\n- #1a1a1a (deep shadows)\nConstraints:\n- Solid white background (#FFFFFF)\n- Top-down perspective (viewed from above)\n- No anti-aliasing, crisp pixel edges\n- CRITICAL: Canvas must be exactly 96 pixels wide and 96 pixels tall\n- CRITICAL: Building must fit within the 96x96 pixel area\n- No shadows cast on the ground\n- Simple, functional design\n- Building should look like a storage shed\n- Consistent pixel art style"
  },
  {
    key: "building-PARK_BENCH",
    filename: "building-park-bench.png",
    prompt: "Subject: A pixel art Park Bench prop for a top-down game world.\nStyle: Flat 2D Pixel Art, 16-bit SNES-era RPG style (like Stardew Valley). Simple, decorative prop.\nDimensions: 32x32 pixels (1x1 tile at 32px per tile)\nContent:\n- Park bench\n- Single tile size, 32x32 pixels\n- Wooden bench with backrest\n- Top-down view showing bench from above\n- Simple, clear design\n- Decorative park furniture\n- Visible seat and backrest\nColor Palette (6 colors maximum):\n- #8b6f47 (wood color - brown)\n- #6b5a3a (dark wood)\n- #2d3436 (shadows)\n- #a0845d (light wood)\n- #ffffff (highlights)\n- #1a1a1a (deep shadows)\nConstraints:\n- Solid white background (#FFFFFF)\n- Top-down perspective (viewed from above)\n- No anti-aliasing, crisp pixel edges\n- CRITICAL: Canvas must be exactly 32 pixels wide and 32 pixels tall\n- CRITICAL: Prop must fit within the 32x32 pixel area\n- No shadows cast on the ground\n- Simple, recognizable bench design\n- Consistent pixel art style"
  },
  {
    key: "building-FOUNTAIN",
    filename: "building-fountain.png",
    prompt: "Subject: A pixel art Fountain prop for a top-down game world.\nStyle: Flat 2D Pixel Art, 16-bit SNES-era RPG style (like Stardew Valley). Decorative water feature.\nDimensions: 64x64 pixels (2x2 tiles at 32px per tile)\nContent:\n- Decorative fountain\n- 2x2 tile size, 64x64 pixels\n- Central fountain structure\n- Water visible in center\n- Decorative base or pedestal\n- Top-down view showing fountain from above\n- Circular or square design\n- Water effects visible\nColor Palette (8 colors maximum):\n- #4db8ff (water color - blue)\n- #3a9bcc (medium water blue)\n- #c0c0c0 (stone/fountain base - gray)\n- #2d3436 (shadows, dark details)\n- #f0f0f0 (highlights, stone)\n- #8b8b8b (gray details)\n- #ffffff (water highlights, foam)\n- #1a1a1a (deep shadows)\nConstraints:\n- Solid white background (#FFFFFF)\n- Top-down perspective (viewed from above)\n- No anti-aliasing, crisp pixel edges\n- CRITICAL: Canvas must be exactly 64 pixels wide and 64 pixels tall\n- CRITICAL: Prop must fit within the 64x64 pixel area\n- No shadows cast on the ground\n- Water should be clearly visible\n- Consistent pixel art style"
  }
];

async function generateAssets() {
  const apiKey = (process as any).env.GEMINI_API_KEY || (process as any).env.API_KEY;
  
  if (!apiKey) {
    console.error("❌ GEMINI_API_KEY is not set in environment variables.");
    (process as any).exit(1);
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const assetsDir = path.resolve((process as any).cwd(), 'public', 'assets');
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  console.log(`🎨 Starting Asset Generation (${ASSETS_TO_GENERATE.length} items)...`);
  console.log(`📁 Output Directory: ${assetsDir}`);

  for (const asset of ASSETS_TO_GENERATE) {
    console.log(`\n⏳ Generating: ${asset.key} (${asset.filename})...`);
    
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: {
            parts: [{ text: asset.prompt }]
        },
        config: {
          imageConfig: {
            aspectRatio: "1:1",
            imageSize: "1K"
          }
        },
      });

      // Find image part
      let imageBase64: string | null = null;
      if (response.candidates && response.candidates[0].content && response.candidates[0].content.parts) {
         for (const part of response.candidates[0].content.parts) {
             if (part.inlineData) {
                 imageBase64 = part.inlineData.data;
                 break;
             }
         }
      }

      if (imageBase64) {
        // Determine subdirectory based on asset type
        const isEnvironment = asset.key.includes('tileset') || asset.key.includes('building');
        const subDir = isEnvironment ? 'environment' : '';
        const targetDir = path.join(assetsDir, subDir);
        
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }
        
        const filePath = path.join(targetDir, asset.filename);
        fs.writeFileSync(filePath, Buffer.from(imageBase64, 'base64'));
        console.log(`✅ Saved: ${subDir ? subDir + '/' : ''}${asset.filename}`);
      } else {
        console.error(`❌ Failed to generate image data for ${asset.key}`);
      }
    } catch (error) {
        console.error(`❌ Error generating ${asset.key}:`, error);
    }
  }

  console.log("\n✨ Asset Generation Complete!");
}

generateAssets().catch(console.error);