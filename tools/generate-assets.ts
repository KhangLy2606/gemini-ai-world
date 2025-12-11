
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
  // --- Tilesets ---
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
  
  // --- Core Campus Buildings ---
  {
    key: "building-CLOCK_TOWER",
    filename: "building-clock-tower.png",
    prompt: "Subject: A pixel art Clock Tower for a top-down game world.\nStyle: Flat 2D Pixel Art, 16-bit SNES-era. Gothic stone aesthetic.\nDimensions: 96x160 pixels (3x5 tiles)\nContent: Tall stone tower with pointed spire, large clock face near top, arched entrance at base. Gothic buttresses.\nColors: #D4C4A8 (stone), #708090 (slate roof), #333333 (dark details), #FFEB3B (lit windows/clock face).\nConstraints: White background, no shadows on ground, exact 96x160 size."
  },
  {
    key: "building-LECTURE_HALL",
    filename: "building-lecture-hall.png",
    prompt: "Subject: A pixel art Lecture Hall for a top-down game world.\nStyle: Flat 2D Pixel Art, 16-bit SNES-era. Georgian brick aesthetic.\nDimensions: 192x128 pixels (6x4 tiles)\nContent: Large rectangular brick building, symmetrical windows, white pillars at entrance, slate roof.\nColors: #A0522D (brick), #708090 (slate), #FFFFFF (trim), #FFEB3B (lit windows).\nConstraints: White background, no shadows on ground, exact 192x128 size."
  },
  {
    key: "building-STUDENT_UNION",
    filename: "building-student-union.png",
    prompt: "Subject: A pixel art Student Union building for a top-down game world.\nStyle: Flat 2D Pixel Art, 16-bit SNES-era. Gothic stone with copper roof.\nDimensions: 160x96 pixels (5x3 tiles)\nContent: Wide stone building, oxidized green copper roof, large welcoming entrance, banners/flags.\nColors: #D4C4A8 (stone), #2E8B57 (copper roof), #DC143C (banners), #FFEB3B (windows).\nConstraints: White background, no shadows on ground, exact 160x96 size."
  },
  {
    key: "building-DORMITORY",
    filename: "building-dormitory.png",
    prompt: "Subject: A pixel art Dormitory building for a top-down game world.\nStyle: Flat 2D Pixel Art, 16-bit SNES-era. Georgian brick aesthetic.\nDimensions: 128x160 pixels (4x5 tiles)\nContent: Tall brick residential building, rows of identical windows, slate roof, simple entrance.\nColors: #A0522D (brick), #708090 (slate), #FFEB3B (lit windows).\nConstraints: White background, no shadows on ground, exact 128x160 size."
  },
  {
    key: "building-STADIUM",
    filename: "building-stadium.png",
    prompt: "Subject: A pixel art Stadium for a top-down game world.\nStyle: Flat 2D Pixel Art, 16-bit SNES-era. Modern elliptical stone/concrete.\nDimensions: 256x192 pixels (8x6 tiles)\nContent: Large oval structure, tiered seating visible, open green field in center, floodlights.\nColors: #8B7355 (stone walls), #228B22 (field), #DC143C (seating), #FFFFFF (lights).\nConstraints: White background, no shadows on ground, exact 256x192 size."
  },
  {
    key: "building-SCIENCE_CENTER",
    filename: "building-science-center.png",
    prompt: "Subject: A pixel art Science Center for a top-down game world.\nStyle: Flat 2D Pixel Art, 16-bit SNES-era. Modern glass and steel.\nDimensions: 160x128 pixels (5x4 tiles)\nContent: Modern building with large glass facades, steel beams, futuristic roof vents, blue tint.\nColors: #B0C4DE (steel), #87CEEB (glass), #708090 (details), #FFFFFF (reflections).\nConstraints: White background, no shadows on ground, exact 160x128 size."
  },

  // --- Campus Props ---
  {
    key: "building-CAMPUS_GATE",
    filename: "building-campus-gate.png",
    prompt: "Subject: A pixel art Campus Gate prop.\nStyle: 16-bit SNES-era pixel art.\nDimensions: 96x64 pixels (3x2 tiles)\nContent: Large iron gate with stone pillars, gold accents, open archway.\nColors: #2F4F4F (iron), #D4C4A8 (stone), #FFD700 (gold).\nConstraints: White background, no shadows."
  },
  {
    key: "building-STATUE",
    filename: "building-statue.png",
    prompt: "Subject: A pixel art Statue prop.\nStyle: 16-bit SNES-era pixel art.\nDimensions: 32x32 pixels (1x1 tile)\nContent: Stone or bronze statue on a pedestal, classical figure.\nColors: #708090 (stone), #8B7355 (bronze).\nConstraints: White background, no shadows."
  },
  {
    key: "building-LAMPPOST",
    filename: "building-lamppost.png",
    prompt: "Subject: A pixel art Lamppost prop.\nStyle: 16-bit SNES-era pixel art.\nDimensions: 32x32 pixels (1x1 tile)\nContent: Tall iron lamppost with glowing yellow lantern top.\nColors: #2F4F4F (iron), #FFD700 (light), #FFEB3B (glow).\nConstraints: White background, no shadows."
  },
  {
    key: "building-BIKE_RACK",
    filename: "building-bike-rack.png",
    prompt: "Subject: A pixel art Bike Rack prop.\nStyle: 16-bit SNES-era pixel art.\nDimensions: 64x32 pixels (2x1 tile)\nContent: Metal bike rack, simple steel loops, maybe one bike parked.\nColors: #4682B4 (steel), #A0A0A0 (metal).\nConstraints: White background, no shadows."
  },
  {
    key: "building-BULLETIN_BOARD",
    filename: "building-bulletin-board.png",
    prompt: "Subject: A pixel art Bulletin Board prop.\nStyle: 16-bit SNES-era pixel art.\nDimensions: 32x32 pixels (1x1 tile)\nContent: Wooden board on posts, covered in white and yellow paper notes.\nColors: #8B4513 (wood), #FFFFFF (paper), #FFFF00 (notes).\nConstraints: White background, no shadows."
  },

  // --- Autumn Plants ---
  {
    key: "plant-TREE_AUTUMN",
    filename: "plant-tree-autumn.png",
    prompt: "Subject: A pixel art Autumn Tree.\nStyle: 16-bit SNES-era pixel art.\nDimensions: 64x64 pixels\nContent: Large deciduous tree with vibrant orange and red leaves, brown trunk.\nColors: #D2691E (orange), #B22222 (red), #8B4513 (trunk).\nConstraints: White background, no shadows."
  },
  {
    key: "plant-TREE_MAPLE",
    filename: "plant-tree-maple.png",
    prompt: "Subject: A pixel art Maple Tree.\nStyle: 16-bit SNES-era pixel art.\nDimensions: 64x64 pixels\nContent: Maple tree with gold and orange foliage, wide canopy.\nColors: #DAA520 (gold), #D2691E (orange), #8B4513 (trunk).\nConstraints: White background, no shadows."
  },
  {
    key: "plant-HEDGE_TRIMMED",
    filename: "plant-hedge-trimmed.png",
    prompt: "Subject: A pixel art Trimmed Hedge.\nStyle: 16-bit SNES-era pixel art.\nDimensions: 64x32 pixels\nContent: Rectangular manicured green hedge, very neat.\nColors: #2E8B57 (green), #3CB371 (highlight).\nConstraints: White background, no shadows."
  },
  {
    key: "plant-FLOWER_BED",
    filename: "plant-flower-bed.png",
    prompt: "Subject: A pixel art Flower Bed.\nStyle: 16-bit SNES-era pixel art.\nDimensions: 64x32 pixels\nContent: Rectangular dirt bed filled with colorful flowers (red, yellow, purple).\nColors: #8B4513 (dirt), #DC143C, #FFD700, #9B59B6 (flowers).\nConstraints: White background, no shadows."
  },
  {
    key: "plant-IVY_WALL",
    filename: "plant-ivy-wall.png",
    prompt: "Subject: A pixel art Ivy Wall section.\nStyle: 16-bit SNES-era pixel art.\nDimensions: 32x64 pixels\nContent: Vertical climbing green ivy leaves, dense.\nColors: #228B22 (green), #006400 (dark green).\nConstraints: White background, no shadows."
  },

  // --- Original Building Types (for completeness) ---
  {
    key: "building-OFFICE",
    filename: "building-office.png",
    prompt: "Subject: A pixel art Tech Office building for a top-down game world.\nStyle: Flat 2D Pixel Art, 16-bit SNES-era RPG style. Modern glass/steel aesthetic.\nDimensions: 128x128 pixels\nContent: Modern office, glass windows, steel frame, rectangular, 4x4 tiles.\nColors: #556b82, #8b5a3c, #4a90e2, #2d3436.\nConstraints: White background, no shadows, exact 128x128 size."
  },
  {
    key: "building-HOSPITAL",
    filename: "building-hospital.png",
    prompt: "Subject: A pixel art Hospital building for a top-down game world.\nStyle: Flat 2D Pixel Art, 16-bit SNES-era. Clean medical aesthetic.\nDimensions: 192x128 pixels\nContent: White building, red cross, clean appearance, 6x4 tiles.\nColors: #f0f0f0, #ff6b6b, #e0e0e0.\nConstraints: White background, no shadows, exact 192x128 size."
  },
  {
    key: "building-CAFE",
    filename: "building-cafe.png",
    prompt: "Subject: A pixel art Cafe building for a top-down game world.\nStyle: Flat 2D Pixel Art, 16-bit SNES-era. Cozy aesthetic.\nDimensions: 96x64 pixels\nContent: Brick building, colorful awning, outdoor seating, 3x2 tiles.\nColors: #d4a574, #8b4513, #ff6b6b.\nConstraints: White background, no shadows, exact 96x64 size."
  },
  {
    key: "building-LIBRARY",
    filename: "building-library.png",
    prompt: "Subject: A pixel art Library building for a top-down game world.\nStyle: Flat 2D Pixel Art, 16-bit SNES-era. Classic aesthetic.\nDimensions: 160x96 pixels\nContent: Classic building, columns, large windows, 5x3 tiles.\nColors: #4a5859, #2d3436, #6b7a8c.\nConstraints: White background, no shadows, exact 160x96 size."
  },
  {
    key: "building-LAB",
    filename: "building-lab.png",
    prompt: "Subject: A pixel art Laboratory building for a top-down game world.\nStyle: Flat 2D Pixel Art, 16-bit SNES-era. Modern scientific aesthetic.\nDimensions: 128x96 pixels\nContent: Modern lab, vents, scientific equipment, 4x3 tiles.\nColors: #4a90e2, #2b5aa0, #6ba3d4.\nConstraints: White background, no shadows, exact 128x96 size."
  },
  {
    key: "building-WAREHOUSE",
    filename: "building-warehouse.png",
    prompt: "Subject: A pixel art Warehouse building for a top-down game world.\nStyle: Flat 2D Pixel Art, 16-bit SNES-era. Industrial aesthetic.\nDimensions: 160x160 pixels\nContent: Large industrial building, big doors, vents, 5x5 tiles.\nColors: #696969, #404040, #8b8b8b.\nConstraints: White background, no shadows, exact 160x160 size."
  },
  {
    key: "building-HOUSE",
    filename: "building-house.png",
    prompt: "Subject: A pixel art House building for a top-down game world.\nStyle: Flat 2D Pixel Art, 16-bit SNES-era. Residential aesthetic.\nDimensions: 96x96 pixels\nContent: Cozy house, chimney, roof, 3x3 tiles.\nColors: #a0745d, #6b4423, #8b6f47.\nConstraints: White background, no shadows, exact 96x96 size."
  },
  {
    key: "building-STORAGE",
    filename: "building-storage.png",
    prompt: "Subject: A pixel art Storage building for a top-down game world.\nStyle: Flat 2D Pixel Art, 16-bit SNES-era. Functional aesthetic.\nDimensions: 96x96 pixels\nContent: Small shed, wooden or metal, 3x3 tiles.\nColors: #5a4a3a, #3a2a1a, #8b6f47.\nConstraints: White background, no shadows, exact 96x96 size."
  },
  {
    key: "building-PARK_BENCH",
    filename: "building-park-bench.png",
    prompt: "Subject: A pixel art Park Bench prop.\nStyle: Flat 2D Pixel Art, 16-bit SNES-era.\nDimensions: 32x32 pixels\nContent: Wooden bench, top-down view.\nColors: #8b6f47, #6b5a3a.\nConstraints: White background, no shadows, exact 32x32 size."
  },
  {
    key: "building-FOUNTAIN",
    filename: "building-fountain.png",
    prompt: "Subject: A pixel art Fountain prop.\nStyle: Flat 2D Pixel Art, 16-bit SNES-era.\nDimensions: 64x64 pixels\nContent: Water fountain, stone base, blue water.\nColors: #4db8ff, #c0c0c0.\nConstraints: White background, no shadows, exact 64x64 size."
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
        const isEnvironment = asset.key.includes('tileset') || asset.key.includes('building') || asset.key.includes('plant');
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
