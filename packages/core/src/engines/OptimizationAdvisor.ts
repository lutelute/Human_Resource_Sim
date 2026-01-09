/**
 * Optimization Advisor
 * 投資配分の最適化アドバイザー
 */

import type {
  SimulationState,
  SkillVector,
  InvestmentAllocation,
  SectorKey,
  CapabilityAxisKey,
  OptimizationRecommendation,
} from '../types';
import { SECTORS, CAPABILITY_AXIS_KEYS, SECTOR_KEYS } from '../types';
import { calculateTotalScore } from '../math/ces';

// Gradient mapping: how each sector affects each capability axis
const SECTOR_GRADIENTS: Record<SectorKey, Partial<Record<CapabilityAxisKey, number>>> = {
  university: {
    basicScience: 2.5,
    education: 2.0,
    innovation: 1.5,
    succession: 1.0,
  },
  industry: {
    appliedTech: 3.0,
    manufacturing: 2.5,
    digitalAI: 2.0,
    implementation: 2.0,
    finance: 1.0,
  },
  government: {
    policyMaking: 2.0,
    globalCompete: 1.5,
    energy: 1.0,
  },
  research: {
    basicScience: 2.5,
    appliedTech: 2.0,
    innovation: 2.5,
    globalCompete: 1.5,
    digitalAI: 1.5,
  },
};

/**
 * Calculate gaps between current capability and target
 */
function calculateGaps(
  current: SkillVector,
  target: SkillVector
): { axis: CapabilityAxisKey; gap: number; priority: number }[] {
  return CAPABILITY_AXIS_KEYS.map(axis => {
    const gap = target[axis] - current[axis];
    // Priority increases for larger gaps and for weaker axes
    const priority = gap > 0 ? gap * (1 + (100 - current[axis]) / 100) : 0;
    return { axis, gap, priority };
  }).sort((a, b) => b.priority - a.priority);
}

/**
 * Calculate which sector best addresses each gap
 */
function calculateSectorEffectiveness(
  gaps: { axis: CapabilityAxisKey; gap: number; priority: number }[]
): Record<SectorKey, number> {
  const effectiveness: Record<SectorKey, number> = {
    university: 0,
    industry: 0,
    government: 0,
    research: 0,
  };

  for (const { axis, priority } of gaps) {
    if (priority <= 0) continue;

    for (const sector of SECTOR_KEYS) {
      const gradient = SECTOR_GRADIENTS[sector][axis] ?? 0;
      effectiveness[sector] += gradient * priority;
    }
  }

  return effectiveness;
}

/**
 * Generate optimal investment allocation
 */
function generateOptimalAllocation(
  effectiveness: Record<SectorKey, number>,
  currentInvestments: InvestmentAllocation
): InvestmentAllocation {
  const totalEffectiveness = Object.values(effectiveness).reduce((a, b) => a + b, 0);

  if (totalEffectiveness === 0) {
    // No clear direction, return balanced allocation
    return { university: 25, industry: 25, government: 25, research: 25 };
  }

  // Calculate proportional allocation
  const raw: InvestmentAllocation = {} as InvestmentAllocation;
  for (const sector of SECTOR_KEYS) {
    raw[sector] = (effectiveness[sector] / totalEffectiveness) * 100;
  }

  // Smooth transition from current allocation (80% new, 20% old for stability)
  const smoothed: InvestmentAllocation = {} as InvestmentAllocation;
  for (const sector of SECTOR_KEYS) {
    smoothed[sector] = Math.round(raw[sector] * 0.8 + currentInvestments[sector] * 0.2);
  }

  // Ensure sum is 100
  const sum = Object.values(smoothed).reduce((a, b) => a + b, 0);
  if (sum !== 100) {
    const maxSector = SECTOR_KEYS.reduce((a, b) =>
      smoothed[a] > smoothed[b] ? a : b
    );
    smoothed[maxSector] += 100 - sum;
  }

  return smoothed;
}

/**
 * Generate rationale for recommendation
 */
function generateRationale(
  gaps: { axis: CapabilityAxisKey; gap: number; priority: number }[],
  suggestedInvestments: InvestmentAllocation,
  currentInvestments: InvestmentAllocation
): string[] {
  const rationale: string[] = [];

  // Top gaps
  const topGaps = gaps.filter(g => g.gap > 5).slice(0, 3);
  if (topGaps.length > 0) {
    const gapNames = topGaps.map(g => {
      const axis = CAPABILITY_AXIS_KEYS.find(k => k === g.axis);
      return axis;
    }).filter(Boolean);
    rationale.push(`主な弱点: ${gapNames.join(', ')} の強化が必要`);
  }

  // Investment changes
  for (const sector of SECTOR_KEYS) {
    const diff = suggestedInvestments[sector] - currentInvestments[sector];
    if (Math.abs(diff) >= 5) {
      const sectorDef = SECTORS.find(s => s.key === sector);
      const direction = diff > 0 ? '増加' : '減少';
      rationale.push(`${sectorDef?.name}: ${Math.abs(diff)}%${direction}を推奨`);
    }
  }

  if (rationale.length === 0) {
    rationale.push('現在の配分は概ね最適です');
  }

  return rationale;
}

/**
 * Estimate score improvement from recommended allocation
 */
function estimateImprovement(
  currentCapability: SkillVector,
  suggestedInvestments: InvestmentAllocation,
  years: number = 5
): number {
  // Simplified estimation: assume linear growth proportional to investment
  const projectedCapability = { ...currentCapability };

  for (const sector of SECTOR_KEYS) {
    const investment = suggestedInvestments[sector] / 100;
    const gradients = SECTOR_GRADIENTS[sector];

    for (const [axis, gradient] of Object.entries(gradients)) {
      const axisKey = axis as CapabilityAxisKey;
      projectedCapability[axisKey] += investment * gradient * years * 0.5;
      projectedCapability[axisKey] = Math.min(100, projectedCapability[axisKey]);
    }
  }

  const currentScore = calculateTotalScore(currentCapability);
  const projectedScore = calculateTotalScore(projectedCapability);

  return projectedScore - currentScore;
}

/**
 * Main advisor function
 */
export function getOptimizationRecommendation(
  state: SimulationState,
  target: SkillVector
): OptimizationRecommendation {
  const gaps = calculateGaps(state.capability, target);
  const effectiveness = calculateSectorEffectiveness(gaps);
  const suggestedInvestments = generateOptimalAllocation(effectiveness, state.investments);
  const rationale = generateRationale(gaps, suggestedInvestments, state.investments);
  const projectedImprovement = estimateImprovement(state.capability, suggestedInvestments);

  // Determine confidence level
  const maxGap = Math.max(...gaps.map(g => Math.abs(g.gap)));
  let confidenceLevel: 'high' | 'medium' | 'low';
  if (maxGap < 10) {
    confidenceLevel = 'high';
  } else if (maxGap < 20) {
    confidenceLevel = 'medium';
  } else {
    confidenceLevel = 'low';
  }

  return {
    suggestedInvestments,
    rationale,
    projectedScoreImprovement: projectedImprovement,
    confidenceLevel,
  };
}

/**
 * Default target capability for optimization
 */
export const DEFAULT_TARGET_CAPABILITY: SkillVector = {
  basicScience: 70,
  appliedTech: 75,
  digitalAI: 80,
  manufacturing: 70,
  finance: 65,
  energy: 70,
  globalCompete: 75,
  innovation: 80,
  education: 70,
  policyMaking: 65,
  implementation: 75,
  succession: 70,
};
