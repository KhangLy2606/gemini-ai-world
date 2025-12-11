
import Phaser from 'phaser';
import { TILE_SIZE } from '../../types';

export class ParticleEffects {
  private scene: Phaser.Scene;
  private leavesEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private fountainEmitters: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  private dustManager: Phaser.GameObjects.Particles.ParticleEmitter | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.initializeParticles();
  }

  private initializeParticles() {
    // We assume 'path_tileset' exists, if not we create a fallback texture for particles
    if (!this.scene.textures.exists('particle_dot')) {
        const graphics = this.scene.make.graphics({ x: 0, y: 0 });
        graphics.fillStyle(0xffffff);
        graphics.fillCircle(4, 4, 4);
        graphics.generateTexture('particle_dot', 8, 8);
    }

    // 1. Falling Autumn Leaves (Global ambient effect)
    // Uses a large emission area that covers the camera view
    this.leavesEmitter = this.scene.add.particles(0, 0, 'particle_dot', {
        frame: 0,
        x: { min: 0, max: 2000 },
        y: -50,
        lifespan: 10000,
        speedY: { min: 20, max: 50 },
        speedX: { min: -10, max: 20 },
        scale: { start: 0.4, end: 0.2 },
        rotate: { start: 0, end: 360 },
        alpha: { start: 0.8, end: 0 },
        quantity: 1,
        frequency: 500,
        tint: [0xD2691E, 0xB22222, 0xDAA520], // Autumn colors
        blendMode: 'NORMAL'
    });
    
    // Fix emitter to camera scroll to simulate world atmosphere
    this.leavesEmitter.setScrollFactor(0); // Actually we want it to spawn relative to camera
    // But for world particles, usually better to spawn in world coordinates or use a screen-sized emitter.
    // Let's attach to camera for "screen space" particles
    // this.leavesEmitter.setScrollFactor(0); 
    // Implementing scroll factor 0 implies UI layer. For world depth, we might want them in world space.
    // Let's keep them in world space but update position in update loop if needed.
    // For now, simpler implementation: World Space coverage.
  }

  public addFountainEffect(x: number, y: number) {
    const emitter = this.scene.add.particles(x + TILE_SIZE, y + TILE_SIZE * 0.8, 'particle_dot', {
        lifespan: 800,
        speed: { min: 50, max: 100 },
        angle: { min: 250, max: 290 }, // Upwards
        gravityY: 200,
        scale: { start: 0.4, end: 0.1 },
        quantity: 2,
        blendMode: 'ADD',
        tint: 0x87CEEB
    });
    this.fountainEmitters.push(emitter);
  }

  public addLampGlow(x: number, y: number) {
    // Add a static light (requires light pipeline enabled on scene)
    if (this.scene.lights.active) {
        const light = this.scene.lights.addLight(x + 16, y + 16, 60, 0xFFD700, 1.5);
    }
  }

  public createDustBurst(x: number, y: number) {
    const emitter = this.scene.add.particles(x, y, 'particle_dot', {
        speed: { min: 10, max: 30 },
        angle: { min: 0, max: 360 },
        scale: { start: 0.3, end: 0 },
        alpha: { start: 0.5, end: 0 },
        lifespan: 400,
        quantity: 4,
        tint: 0xE0E0E0,
        emitting: false
    });
    
    emitter.explode(4, x, y);
    // Cleanup handled by Phaser if configured, or we can manually destroy
    this.scene.time.delayedCall(500, () => emitter.destroy());
  }

  public update(time: number, delta: number) {
    // Update leaf emitter position to match camera view if desired
    // For this MVP, we leave it covering a large static area
  }

  public destroy() {
    if (this.leavesEmitter) this.leavesEmitter.destroy();
    this.fountainEmitters.forEach(e => e.destroy());
  }
}
