
import { GoogleGenAI } from "@google/genai";

declare var process: any;

export class ImageGenerationService {
  
  private static getClient() {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      console.error("API Key missing. Make sure GEMINI_API_KEY is set in .env.local");
      throw new Error("API Key not found");
    }
    return new GoogleGenAI({ apiKey });
  }

  /**
   * Generate a character sprite from a text prompt using Gemini 2.5 Flash Image
   */
  static async generateCharacterSprite(prompt: string): Promise<string> {
    console.log(`Generating sprite for prompt: "${prompt}"...`);
    
    const ai = this.getClient();
    // Enforce pixel art constraints in the prompt
    const enhancedPrompt = `A single 32x32 pixel art character sprite of ${prompt}. \n\nStyle: Flat 2D Pixel Art, SNES style, white background, full body facing forward, no shadows. The image must be exactly square.`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
            parts: [{ text: enhancedPrompt }]
        }
      });

      return this.extractImage(response);
    } catch (error) {
      console.error("Generation failed:", error);
      throw error;
    }
  }

  /**
   * Generate a high-quality asset using Gemini 3 Pro Image (Nano Banana Pro)
   */
  static async generateHighQualityAsset(prompt: string, size: '1K' | '2K' | '4K'): Promise<string> {
    console.log(`Generating HQ asset (${size}) for prompt: "${prompt}"...`);
    
    // Create a new instance every call to ensure the latest API key is used
    // This is critical if the key was just selected via the UI dialog
    const ai = this.getClient();
    
    const enhancedPrompt = `Pixel art game asset: ${prompt}. \n\nStyle: Flat 2D Pixel Art, SNES style, high quality, white background.`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: {
            parts: [{ text: enhancedPrompt }]
        },
        config: {
          imageConfig: {
            aspectRatio: "1:1",
            imageSize: size
          }
        }
      });

      return this.extractImage(response);
    } catch (error) {
      console.error("HQ Generation failed:", error);
      throw error;
    }
  }

  /**
   * Edit an existing character sprite using Gemini 2.5 Flash Image
   */
  static async editCharacterSprite(imageBase64: string, prompt: string): Promise<string> {
    console.log(`Editing sprite with prompt: "${prompt}"...`);
    
    const ai = this.getClient();
    
    // Ensure base64 string is clean (remove data:image/png;base64, prefix if present for the API call)
    // The API expects raw base64 data in the inlineData field.
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const mimeType = 'image/png'; // Assuming PNG for sprites

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType
              }
            },
            { 
              text: `Edit this pixel art character: ${prompt}. Maintain 32x32 pixel art style, white background, and identical perspective.` 
            }
          ]
        }
      });

      return this.extractImage(response);
    } catch (error) {
      console.error("Editing failed:", error);
      throw error;
    }
  }

  /**
   * Helper to extract the base64 image from the Gemini response
   */
  private static extractImage(response: any): string {
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
    }
    throw new Error("No image generated in response");
  }
}
