/**
 * Statistical Functions
 * 統計計算ユーティリティ
 */

import type { SkillDistribution, SkillVector, SkillDistributionVector } from '../types';
import { SIMULATION_CONSTANTS, CAPABILITY_AXIS_KEYS } from '../types';

/**
 * Calculate weighted mean
 */
export function weightedMean(values: number[], weights: number[]): number {
  if (values.length !== weights.length || values.length === 0) {
    throw new Error('Values and weights must have same non-zero length');
  }

  let sum = 0;
  let totalWeight = 0;

  for (let i = 0; i < values.length; i++) {
    sum += values[i] * weights[i];
    totalWeight += weights[i];
  }

  return totalWeight > 0 ? sum / totalWeight : 0;
}

/**
 * Calculate pooled standard deviation for multiple distributions
 */
export function pooledStd(distributions: { mean: number; std: number; n: number }[]): number {
  if (distributions.length === 0) return 0;

  let totalN = 0;
  let sumSquares = 0;
  let grandMean = 0;

  // Calculate grand mean
  for (const d of distributions) {
    grandMean += d.mean * d.n;
    totalN += d.n;
  }
  grandMean = totalN > 0 ? grandMean / totalN : 0;

  // Calculate pooled variance (within-group + between-group)
  for (const d of distributions) {
    // Within-group variance
    sumSquares += (d.std ** 2) * d.n;
    // Between-group variance
    sumSquares += ((d.mean - grandMean) ** 2) * d.n;
  }

  return totalN > 0 ? Math.sqrt(sumSquares / totalN) : 0;
}

/**
 * Convert raw score to deviation score (偏差値)
 */
export function toDeviationScore(value: number, mean: number, std: number): number {
  if (std === 0) return SIMULATION_CONSTANTS.DEVIATION_BASE;
  const z = (value - mean) / std;
  return SIMULATION_CONSTANTS.DEVIATION_BASE + SIMULATION_CONSTANTS.DEVIATION_SCALE * z;
}

/**
 * Convert deviation score back to raw score
 */
export function fromDeviationScore(deviation: number, mean: number, std: number): number {
  const z = (deviation - SIMULATION_CONSTANTS.DEVIATION_BASE) / SIMULATION_CONSTANTS.DEVIATION_SCALE;
  return mean + z * std;
}

/**
 * Calculate percentile from z-score
 */
export function zToPercentile(z: number): number {
  // Approximation of standard normal CDF
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? (1 - p) * 100 : p * 100;
}

/**
 * Calculate z-score from percentile
 */
export function percentileToZ(percentile: number): number {
  // Approximation of inverse standard normal CDF
  const p = percentile / 100;
  if (p <= 0) return -4;
  if (p >= 1) return 4;

  // Rational approximation
  const a = [
    -3.969683028665376e+01,
    2.209460984245205e+02,
    -2.759285104469687e+02,
    1.383577518672690e+02,
    -3.066479806614716e+01,
    2.506628277459239e+00
  ];
  const b = [
    -5.447609879822406e+01,
    1.615858368580409e+02,
    -1.556989798598866e+02,
    6.680131188771972e+01,
    -1.328068155288572e+01
  ];
  const c = [
    -7.784894002430293e-03,
    -3.223964580411365e-01,
    -2.400758277161838e+00,
    -2.549732539343734e+00,
    4.374664141464968e+00,
    2.938163982698783e+00
  ];
  const d = [
    7.784695709041462e-03,
    3.224671290700398e-01,
    2.445134137142996e+00,
    3.754408661907416e+00
  ];

  const pLow = 0.02425;
  const pHigh = 1 - pLow;

  let q: number, r: number;

  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
           ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  } else if (p <= pHigh) {
    q = p - 0.5;
    r = q * q;
    return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q /
           (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
            ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  }
}

/**
 * Calculate key person contribution (top percentile performers)
 */
export function keyPersonContribution(
  distribution: SkillDistribution,
  count: number,
  percentile: number = SIMULATION_CONSTANTS.KEY_PERSON_RATIO
): number {
  const zScore = percentileToZ((1 - percentile) * 100);
  const keyPersonValue = distribution.mean + zScore * distribution.std;
  const keyPersonCount = count * percentile;
  return keyPersonValue * keyPersonCount;
}

/**
 * Aggregate skill distributions to single value (analytical)
 */
export function aggregateDistributions(
  distributions: { distribution: SkillDistribution; weight: number }[]
): SkillDistribution {
  if (distributions.length === 0) {
    return { mean: 0, std: 10 };
  }

  let totalWeight = 0;
  let weightedMeanSum = 0;

  for (const d of distributions) {
    weightedMeanSum += d.distribution.mean * d.weight;
    totalWeight += d.weight;
  }

  const mean = totalWeight > 0 ? weightedMeanSum / totalWeight : 0;

  // Calculate pooled std
  let varianceSum = 0;
  for (const d of distributions) {
    const diff = d.distribution.mean - mean;
    varianceSum += (d.distribution.std ** 2 + diff ** 2) * d.weight;
  }

  const std = totalWeight > 0 ? Math.sqrt(varianceSum / totalWeight) : 10;

  return { mean, std: std || 10 };
}

/**
 * Calculate summary statistics for an array
 */
export function summarize(values: number[]): {
  mean: number;
  std: number;
  min: number;
  max: number;
  median: number;
  p5: number;
  p25: number;
  p75: number;
  p95: number;
} {
  if (values.length === 0) {
    return { mean: 0, std: 0, min: 0, max: 0, median: 0, p5: 0, p25: 0, p75: 0, p95: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;

  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / n;

  const percentile = (p: number) => {
    const idx = (p / 100) * (n - 1);
    const lower = Math.floor(idx);
    const upper = Math.ceil(idx);
    if (lower === upper) return sorted[lower];
    return sorted[lower] * (upper - idx) + sorted[upper] * (idx - lower);
  };

  return {
    mean,
    std: Math.sqrt(variance),
    min: sorted[0],
    max: sorted[n - 1],
    median: percentile(50),
    p5: percentile(5),
    p25: percentile(25),
    p75: percentile(75),
    p95: percentile(95),
  };
}

/**
 * Create empty skill vector
 */
export function createEmptySkillVector(): SkillVector {
  const vector: Partial<SkillVector> = {};
  for (const key of CAPABILITY_AXIS_KEYS) {
    vector[key] = 0;
  }
  return vector as SkillVector;
}

/**
 * Create skill distribution vector with default values
 */
export function createDefaultSkillDistribution(baseMean: number = 50, baseStd: number = 10): SkillDistributionVector {
  const vector: Partial<SkillDistributionVector> = {};
  for (const key of CAPABILITY_AXIS_KEYS) {
    vector[key] = { mean: baseMean, std: baseStd };
  }
  return vector as SkillDistributionVector;
}
