/**
 * CES (Constant Elasticity of Substitution) Production Function
 * 国家能力の集計に使用するCES生産関数
 *
 * Formula:
 * S_j(t) = (Σ n_c × μ_{c,j}^α)^{1/α} × Π(1 - e^{-β × keyPerson_k})
 *
 * - First term: CES aggregation with complementarity (α < 1)
 * - Second term: Key person dependency penalty
 */

import type { Cohort, SkillVector, CapabilityAxisKey } from '../types';
import { SIMULATION_CONSTANTS, CAPABILITY_AXIS_KEYS } from '../types';
import { keyPersonContribution } from './statistics';

/**
 * Calculate CES aggregation for a single capability axis
 */
export function calculateCESValue(
  inputs: number[],
  weights: number[],
  exponent: number = SIMULATION_CONSTANTS.CES_EXPONENT
): number {
  if (inputs.length !== weights.length || inputs.length === 0) {
    return 0;
  }

  let weightedSum = 0;
  let totalWeight = 0;

  for (let i = 0; i < inputs.length; i++) {
    // Ensure non-negative inputs for power operation
    const safeInput = Math.max(0.01, inputs[i]);
    weightedSum += weights[i] * Math.pow(safeInput, exponent);
    totalWeight += weights[i];
  }

  if (totalWeight === 0) return 0;

  // CES aggregation: (weighted sum)^(1/α)
  return Math.pow(weightedSum / totalWeight, 1 / exponent);
}

/**
 * Calculate key person penalty factor
 *
 * Penalizes sectors where key persons (top 5%) are missing
 * Formula: Π(1 - e^{-β × keyPerson_k})
 */
export function calculateKeyPersonPenalty(
  keyPersonValue: number,
  beta: number = 0.1
): number {
  return 1 - Math.exp(-beta * keyPersonValue);
}

/**
 * Calculate national capability for a single axis from cohorts
 */
export function calculateAxisCapability(
  cohorts: Cohort[],
  axisKey: CapabilityAxisKey,
  options: {
    cesExponent?: number;
    keyPersonRatio?: number;
    includeKeyPersonBonus?: boolean;
  } = {}
): number {
  const {
    cesExponent = SIMULATION_CONSTANTS.CES_EXPONENT,
    keyPersonRatio = SIMULATION_CONSTANTS.KEY_PERSON_RATIO,
    includeKeyPersonBonus = true,
  } = options;

  // Extract means and counts for CES calculation
  const inputs: number[] = [];
  const weights: number[] = [];
  let totalKeyPersonContrib = 0;

  for (const cohort of cohorts) {
    const skill = cohort.skills[axisKey];
    inputs.push(skill.mean);
    weights.push(cohort.count);

    if (includeKeyPersonBonus) {
      totalKeyPersonContrib += keyPersonContribution(skill, cohort.count, keyPersonRatio);
    }
  }

  // Base CES value
  const cesValue = calculateCESValue(inputs, weights, cesExponent);

  // Add key person bonus (scaled)
  const totalCount = weights.reduce((a, b) => a + b, 0);
  const keyPersonBonus = totalCount > 0
    ? (totalKeyPersonContrib / totalCount) * SIMULATION_CONSTANTS.KEY_PERSON_RATIO
    : 0;

  return cesValue + keyPersonBonus;
}

/**
 * Calculate full national capability vector from cohorts
 */
export function calculateNationalCapability(
  cohorts: Cohort[],
  options: {
    cesExponent?: number;
    keyPersonRatio?: number;
    includeKeyPersonBonus?: boolean;
  } = {}
): SkillVector {
  const capability: Partial<SkillVector> = {};

  for (const axisKey of CAPABILITY_AXIS_KEYS) {
    capability[axisKey] = calculateAxisCapability(cohorts, axisKey, options);
  }

  return capability as SkillVector;
}

/**
 * Calculate total score from capability vector
 * Score = 0.6 × Average + 0.4 × Minimum (penalizes weakness)
 */
export function calculateTotalScore(capability: SkillVector): number {
  const values = CAPABILITY_AXIS_KEYS.map(key => capability[key]);

  if (values.length === 0) return 0;

  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const min = Math.min(...values);

  return SIMULATION_CONSTANTS.SCORE_AVG_WEIGHT * avg +
         SIMULATION_CONSTANTS.SCORE_MIN_WEIGHT * min;
}

/**
 * Calculate achievement rate against target
 * Uses cosine similarity for multi-dimensional comparison
 */
export function calculateAchievementRate(
  current: SkillVector,
  target: SkillVector
): number {
  let dotProduct = 0;
  let currentMag = 0;
  let targetMag = 0;

  for (const key of CAPABILITY_AXIS_KEYS) {
    dotProduct += current[key] * target[key];
    currentMag += current[key] ** 2;
    targetMag += target[key] ** 2;
  }

  currentMag = Math.sqrt(currentMag);
  targetMag = Math.sqrt(targetMag);

  if (currentMag === 0 || targetMag === 0) return 0;

  // Cosine similarity converted to percentage
  const cosineSim = dotProduct / (currentMag * targetMag);

  // Also factor in magnitude ratio
  const magRatio = Math.min(currentMag / targetMag, 1);

  return cosineSim * magRatio * 100;
}

/**
 * Normalize capability vector using global statistics
 */
export function normalizeCapability(
  capability: SkillVector,
  globalStats: { mean: number; std: number }
): SkillVector {
  const normalized: Partial<SkillVector> = {};

  for (const key of CAPABILITY_AXIS_KEYS) {
    const value = capability[key];
    const z = globalStats.std > 0 ? (value - globalStats.mean) / globalStats.std : 0;
    normalized[key] = SIMULATION_CONSTANTS.DEVIATION_BASE +
                      SIMULATION_CONSTANTS.DEVIATION_SCALE * z;
  }

  return normalized as SkillVector;
}

/**
 * Calculate elasticity of substitution between two axes
 */
export function calculateElasticity(
  cesExponent: number = SIMULATION_CONSTANTS.CES_EXPONENT
): number {
  // σ = 1 / (1 - α)
  return 1 / (1 - cesExponent);
}
