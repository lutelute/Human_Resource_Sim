/**
 * Seeded Random Number Generator
 * 再現性のある乱数生成器 (Mulberry32 PRNG)
 */

export class SeededRandom {
  private seed: number;

  constructor(seed: number = Date.now()) {
    this.seed = seed >>> 0; // Ensure 32-bit unsigned integer
  }

  /**
   * Get current seed
   */
  getSeed(): number {
    return this.seed;
  }

  /**
   * Generate next random number in [0, 1)
   * Uses Mulberry32 algorithm for deterministic PRNG
   */
  next(): number {
    let t = (this.seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Generate random number in [min, max)
   */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /**
   * Generate random integer in [min, max]
   */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  /**
   * Generate normally distributed random number using Box-Muller transform
   */
  gaussian(mean: number = 0, std: number = 1): number {
    const u1 = this.next();
    const u2 = this.next();
    // Avoid log(0)
    const safeU1 = Math.max(u1, 1e-10);
    const z = Math.sqrt(-2 * Math.log(safeU1)) * Math.cos(2 * Math.PI * u2);
    return mean + z * std;
  }

  /**
   * Generate truncated normal distribution (bounded)
   */
  truncatedGaussian(mean: number, std: number, min: number, max: number): number {
    let value: number;
    let attempts = 0;
    const maxAttempts = 100;

    do {
      value = this.gaussian(mean, std);
      attempts++;
    } while ((value < min || value > max) && attempts < maxAttempts);

    // Fallback to clamping if too many rejections
    return Math.max(min, Math.min(max, value));
  }

  /**
   * Shuffle array in place (Fisher-Yates)
   */
  shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  /**
   * Pick random element from array
   */
  pick<T>(array: T[]): T {
    return array[this.int(0, array.length - 1)];
  }

  /**
   * Generate boolean with given probability
   */
  chance(probability: number): boolean {
    return this.next() < probability;
  }
}

/**
 * Global deterministic mode flag
 */
let globalDeterministicMode = false;
let globalRng: SeededRandom | null = null;

export function setDeterministicMode(enabled: boolean, seed?: number): void {
  globalDeterministicMode = enabled;
  if (enabled) {
    globalRng = new SeededRandom(seed ?? 12345);
  } else {
    globalRng = null;
  }
}

export function isDeterministicMode(): boolean {
  return globalDeterministicMode;
}

export function getGlobalRng(): SeededRandom | null {
  return globalRng;
}

/**
 * Get random value - uses seeded RNG if deterministic mode, else Math.random()
 */
export function random(): number {
  return globalRng ? globalRng.next() : Math.random();
}

/**
 * Get gaussian random - uses seeded RNG if deterministic mode
 */
export function gaussianRandom(mean: number = 0, std: number = 1): number {
  if (globalRng) {
    return globalRng.gaussian(mean, std);
  }
  // Box-Muller with Math.random()
  const u1 = Math.max(Math.random(), 1e-10);
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * std;
}
