// Simple Seeded Random Number Generator
// Uses a Linear Congruential Generator (LCG) for deterministic results

export class SeededRNG {
  private seed: number;

  constructor(seed: number | string) {
    if (typeof seed === 'string') {
      this.seed = this.hashString(seed);
    } else {
      this.seed = seed;
    }
  }

  /**
   * Generate a random float between 0 and 1
   */
  public random(): number {
    // LCG constants (Microsoft Visual C++ values)
    const a = 214013;
    const c = 2531011;
    const m = 2147483648; // 2^31

    this.seed = (a * this.seed + c) % m;
    return this.seed / m;
  }

  /**
   * Generate a random integer between min (inclusive) and max (exclusive)
   */
  public range(min: number, max: number): number {
    return Math.floor(this.random() * (max - min) + min);
  }

  /**
   * Pick a random element from an array
   */
  public pick<T>(array: T[] | readonly T[]): T {
    return array[Math.floor(this.random() * array.length)];
  }

  /**
   * Simple string hashing to integer
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }
}
