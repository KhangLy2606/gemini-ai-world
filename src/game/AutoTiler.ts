

export type BitmaskValue = number;
export type TileIndex = number;

/**
 * AutoTiler handles bitmask calculations for 47-tile autotiling.
 * Uses standard Wang/Blob tileset layout.
 */
export class AutoTiler {
  /**
   * Calculates the bitmask for a given cell based on its neighbors.
   * Checks 8 neighbors (top-left, top, top-right, left, right, bottom-left, bottom, bottom-right).
   * 
   * @param x Grid X
   * @param y Grid Y
   * @param isSameType Function to check if a neighbor is of the same type
   */
  public static calculateBitmask(
    x: number, 
    y: number, 
    isSameType: (nx: number, ny: number) => boolean
  ): BitmaskValue {
    try {
      let bitmask = 0;

      // Directions: N, W, E, S
      const n = isSameType(x, y - 1) ? 1 : 0;
      const w = isSameType(x - 1, y) ? 1 : 0;
      const e = isSameType(x + 1, y) ? 1 : 0;
      const s = isSameType(x, y + 1) ? 1 : 0;

      // Corners: NW, NE, SW, SE
      // Corners only matter if their cardinal neighbors are also present
      const nw = (n && w && isSameType(x - 1, y - 1)) ? 1 : 0;
      const ne = (n && e && isSameType(x + 1, y - 1)) ? 1 : 0;
      const sw = (s && w && isSameType(x - 1, y + 1)) ? 1 : 0;
      const se = (s && e && isSameType(x + 1, y + 1)) ? 1 : 0;

      // Construct bitmask
      // 1  2  4
      // 8     16
      // 32 64 128
      if (nw) bitmask += 1;
      if (n)  bitmask += 2;
      if (ne) bitmask += 4;
      if (w)  bitmask += 8;
      if (e)  bitmask += 16;
      if (sw) bitmask += 32;
      if (s)  bitmask += 64;
      if (se) bitmask += 128;

      return bitmask;
    } catch (error) {
      console.error('AutoTiler calculation error:', error);
      return 0; // Default to isolated tile on error
    }
  }

  /**
   * Validates if a bitmask is within the expected range (0-255).
   */
  public static validateBitmask(bitmask: number): boolean {
    return bitmask >= 0 && bitmask <= 255;
  }

  /**
   * Maps a bitmask to a tile index in a standard 47-tile blobset.
   * 
   * Mapping based on standard 47-tile blob tileset indices (0-46).
   */
  public static getTileIndex(bitmask: number): TileIndex {
    if (!this.validateBitmask(bitmask)) {
      console.warn(`Invalid bitmask: ${bitmask}, defaulting to 0`);
      return 0;
    }
    return this.bitmaskToFrame[bitmask] ?? 0;
  }

  // Mapping from 8-bit mask to frame index (0-46)
  // Standard 47-tile blob tileset layout
  private static bitmaskToFrame: Record<number, number> = {
    0: 46, // Isolated
    // Single edges
    2: 1, 8: 2, 10: 3, 11: 4, 16: 5, 18: 6, 22: 7, 24: 8, 26: 9, 27: 10, 30: 11, 31: 12,
    64: 13, 66: 14, 72: 15, 74: 16, 75: 17, 80: 18, 82: 19, 86: 20, 88: 21, 90: 22, 91: 23, 94: 24, 95: 25,
    104: 26, 106: 27, 107: 28, 120: 29, 122: 30, 123: 31, 126: 32, 127: 33, 208: 34, 210: 35, 214: 36, 216: 37,
    218: 38, 219: 39, 222: 40, 223: 41, 248: 42, 250: 43, 251: 44, 254: 45, 255: 0 // Center
  };
}
