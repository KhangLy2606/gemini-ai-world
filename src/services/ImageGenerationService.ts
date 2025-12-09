
import { JobRole, JOB_SKINS } from '../config/JobRegistry';

// Mock service to simulate image generation
// In a real app, this would call the backend which interfaces with Gemini 3 Pro Image

export class ImageGenerationService {
  
  /**
   * Simulate generating a character sprite from a text prompt
   * Returns a data URL or image URL
   */
  static async generateCharacterSprite(prompt: string): Promise<string> {
    console.log(`Generating sprite for prompt: "${prompt}"...`);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    // For the mock, we'll return a random existing sprite from our assets
    // In reality, this would return the URL of the generated image from the backend
    // Since we can't easily generate a real pixel art image in the browser without the API,
    // we will use a placeholder approach.
    
    // However, to make it feel "real" in the UI, we can return a placeholder 
    // or just pick a random job skin index to use if we were creating a real agent.
    // But the UI expects an image URL to display.
    
    // Let's return a placeholder colored square as a data URL for now, 
    // or if we can, use a generic placeholder.
    
    return this.createPlaceholderImage(prompt);
  }

  private static createPlaceholderImage(seed: string): string {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      // Generate a deterministic color based on the prompt
      let hash = 0;
      for (let i = 0; i < seed.length; i++) {
        hash = seed.charCodeAt(i) + ((hash << 5) - hash);
      }
      const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
      const color = '#' + '00000'.substring(0, 6 - c.length) + c;

      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 32, 32);
      
      // Add some "pixel art" noise
      for(let i=0; i<16; i++) {
          ctx.fillStyle = 'rgba(255,255,255,0.2)';
          ctx.fillRect(Math.random() * 32, Math.random() * 32, 4, 4);
      }
      
      // Eyes
      ctx.fillStyle = 'black';
      ctx.fillRect(8, 10, 4, 4);
      ctx.fillRect(20, 10, 4, 4);
    }
    
    return canvas.toDataURL();
  }
}
