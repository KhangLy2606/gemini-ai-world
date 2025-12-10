import { describe, it, expect } from 'vitest';
import { AutoTiler } from '../game/AutoTiler';

describe('AutoTiler', () => {
  it('should calculate bitmask correctly for isolated tile', () => {
    const isSameType = () => false;
    const bitmask = AutoTiler.calculateBitmask(1, 1, isSameType);
    expect(bitmask).toBe(0);
  });

  it('should calculate bitmask correctly for center tile', () => {
    const isSameType = () => true;
    const bitmask = AutoTiler.calculateBitmask(1, 1, isSameType);
    expect(bitmask).toBe(255);
  });

  it('should map bitmask 0 to tile index 46 (isolated)', () => {
    const index = AutoTiler.getTileIndex(0);
    expect(index).toBe(46);
  });

  it('should map bitmask 255 to tile index 0 (center)', () => {
    const index = AutoTiler.getTileIndex(255);
    expect(index).toBe(0);
  });
});
