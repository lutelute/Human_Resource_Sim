/**
 * Simulation Engine
 * シミュレーションの中核エンジン
 */

import type {
  Cohort,
  SimulationState,
  SimulationConfig,
  HistoryEntry,
  SimulationResult,
  InvestmentAllocation,
  PolicyParameters,
  SkillVector,
  CapabilityAxisKey,
  SectorKey,
  TransitionRule,
} from '../types';
import {
  SIMULATION_CONSTANTS,
  CAPABILITY_AXIS_KEYS,
  SECTORS,
  DEFAULT_INVESTMENTS,
  DEFAULT_POLICY_PARAMS,
} from '../types';
import { SeededRandom } from '../math/random';
import { calculateNationalCapability, calculateTotalScore, normalizeCapability } from '../math/ces';

// ============================================
// Population Statistics (Japan-based)
// ============================================

export const POPULATION_STATS = {
  baseYear: 2024,
  age18Population: 1100000,
  age22Population: 1150000,
  universityEnrollmentRate: 0.56,
  annualDeclineRate: 0.012,
  projections: {
    2024: 1.0,
    2030: 0.95,
    2040: 0.84,
    2050: 0.72,
    2060: 0.60,
  } as Record<number, number>,
};

// ============================================
// Sector Growth Mappings
// ============================================

const SECTOR_GROWTH_MAP: Record<SectorKey, Partial<Record<CapabilityAxisKey, number>>> = {
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

// ============================================
// Decay Rates by Axis
// ============================================

const DECAY_RATES: Partial<Record<CapabilityAxisKey, number>> = {
  digitalAI: SIMULATION_CONSTANTS.DIGITAL_AI_DECAY,
};

function getDecayRate(axisKey: CapabilityAxisKey): number {
  return DECAY_RATES[axisKey] ?? SIMULATION_CONSTANTS.STANDARD_DECAY;
}

// ============================================
// Transition Matrix
// ============================================

export const DEFAULT_TRANSITIONS: TransitionRule[] = [
  // University transitions
  { from: 'master_student', to: 'phd_student', probability: 0.1 },
  { from: 'master_student', to: 'ind_junior', probability: 0.6 },
  { from: 'master_student', to: 'exit', probability: 0.3 },
  { from: 'phd_student', to: 'postdoc', probability: 0.5 },
  { from: 'phd_student', to: 'res_junior', probability: 0.2 },
  { from: 'phd_student', to: 'ind_mid', probability: 0.2 },
  { from: 'postdoc', to: 'assist_prof', probability: 0.3 },
  { from: 'postdoc', to: 'res_mid', probability: 0.3 },
  { from: 'assist_prof', to: 'prof_mid', probability: 0.5 },
  { from: 'prof_mid', to: 'prof_senior', probability: 0.6 },
  { from: 'prof_senior', to: 'retire', probability: 0.1 },

  // Industry transitions
  { from: 'ind_junior', to: 'ind_mid', probability: 0.7 },
  { from: 'ind_mid', to: 'ind_senior', probability: 0.5 },
  { from: 'ind_senior', to: 'retire', probability: 0.15 },

  // Government transitions (high rotation)
  { from: 'gov_junior', to: 'gov_mid', probability: 0.6 },
  { from: 'gov_mid', to: 'gov_senior', probability: 0.4 },
  { from: 'gov_senior', to: 'retire', probability: 0.2 },

  // Research transitions
  { from: 'res_junior', to: 'res_mid', probability: 0.6 },
  { from: 'res_mid', to: 'res_senior', probability: 0.5 },
  { from: 'res_senior', to: 'retire', probability: 0.1 },
];

// ============================================
// Initial Cohorts Factory
// ============================================

export function createInitialCohorts(): Cohort[] {
  const baseMean = 50;
  const baseStd = 12;

  const createSkills = (sectorKey: SectorKey, bonus: number = 0) => {
    const skills: Record<string, { mean: number; std: number }> = {};
    const sectorDef = SECTORS.find(s => s.key === sectorKey);

    for (const axis of CAPABILITY_AXIS_KEYS) {
      const isGrowthAxis = sectorDef?.growthAxes.includes(axis);
      skills[axis] = {
        mean: baseMean + bonus + (isGrowthAxis ? 10 : 0),
        std: baseStd,
      };
    }
    return skills as Cohort['skills'];
  };

  return [
    // University (6 cohorts)
    { id: 'master_student', sector: 'university', role: '修士学生', roleEn: 'Master Student', count: 60000, avgAge: 24, avgTenure: 1, maxTenure: 2, skills: createSkills('university', -10) },
    { id: 'phd_student', sector: 'university', role: '博士学生', roleEn: 'PhD Student', count: 15000, avgAge: 27, avgTenure: 2, maxTenure: 5, skills: createSkills('university', -5) },
    { id: 'postdoc', sector: 'university', role: 'ポスドク', roleEn: 'Postdoc', count: 8000, avgAge: 32, avgTenure: 2, maxTenure: 5, skills: createSkills('university', 5) },
    { id: 'assist_prof', sector: 'university', role: '助教', roleEn: 'Assistant Professor', count: 12000, avgAge: 36, avgTenure: 4, maxTenure: 10, skills: createSkills('university', 10) },
    { id: 'prof_mid', sector: 'university', role: '准教授', roleEn: 'Associate Professor', count: 18000, avgAge: 45, avgTenure: 8, maxTenure: 15, skills: createSkills('university', 15) },
    { id: 'prof_senior', sector: 'university', role: '教授', roleEn: 'Professor', count: 25000, avgAge: 55, avgTenure: 15, maxTenure: 30, skills: createSkills('university', 20) },

    // Industry (3 cohorts)
    { id: 'ind_junior', sector: 'industry', role: '若手技術者', roleEn: 'Junior Engineer', count: 150000, avgAge: 28, avgTenure: 3, maxTenure: 8, skills: createSkills('industry', 0) },
    { id: 'ind_mid', sector: 'industry', role: '中堅技術者', roleEn: 'Mid-level Engineer', count: 100000, avgAge: 38, avgTenure: 10, maxTenure: 20, skills: createSkills('industry', 10) },
    { id: 'ind_senior', sector: 'industry', role: 'シニア技術者', roleEn: 'Senior Engineer', count: 50000, avgAge: 52, avgTenure: 20, maxTenure: 35, skills: createSkills('industry', 15) },

    // Government (3 cohorts)
    { id: 'gov_junior', sector: 'government', role: '若手官僚', roleEn: 'Junior Official', count: 25000, avgAge: 30, avgTenure: 2, maxTenure: 5, skills: createSkills('government', 0) },
    { id: 'gov_mid', sector: 'government', role: '中堅官僚', roleEn: 'Mid-level Official', count: 18000, avgAge: 42, avgTenure: 5, maxTenure: 10, skills: createSkills('government', 10) },
    { id: 'gov_senior', sector: 'government', role: '幹部官僚', roleEn: 'Senior Official', count: 7000, avgAge: 55, avgTenure: 10, maxTenure: 20, skills: createSkills('government', 15) },

    // Research (3 cohorts)
    { id: 'res_junior', sector: 'research', role: '若手研究者', roleEn: 'Junior Researcher', count: 20000, avgAge: 30, avgTenure: 3, maxTenure: 8, skills: createSkills('research', 5) },
    { id: 'res_mid', sector: 'research', role: '主任研究者', roleEn: 'Senior Researcher', count: 18000, avgAge: 42, avgTenure: 8, maxTenure: 15, skills: createSkills('research', 12) },
    { id: 'res_senior', sector: 'research', role: '主席研究者', roleEn: 'Principal Researcher', count: 12000, avgAge: 55, avgTenure: 15, maxTenure: 25, skills: createSkills('research', 18) },
  ];
}

// ============================================
// Simulation Engine Class
// ============================================

export class SimulationEngine {
  private state: SimulationState<'cohort'>;
  private history: HistoryEntry[] = [];
  private rng: SeededRandom;

  constructor(config: Partial<SimulationConfig> = {}) {
    const fullConfig: SimulationConfig = {
      mode: config.mode ?? 'cohort',
      seed: config.seed ?? Date.now(),
      baseYear: config.baseYear ?? POPULATION_STATS.baseYear,
      enableStochasticity: config.enableStochasticity ?? false,
    };

    this.rng = new SeededRandom(fullConfig.seed);

    const cohorts = createInitialCohorts();
    const capability = calculateNationalCapability(cohorts);

    this.state = {
      year: 0,
      entities: cohorts,
      capability,
      capabilityNormalized: this.normalizeToDeviation(capability),
      investments: { ...DEFAULT_INVESTMENTS },
      policyParams: { ...DEFAULT_POLICY_PARAMS },
      totalTalent: this.calculateTotalTalent(cohorts),
      successionScore: this.calculateSuccessionScore(cohorts),
      config: fullConfig,
    };

    this.recordHistory();
  }

  // ============================================
  // Public API
  // ============================================

  getState(): SimulationState<'cohort'> {
    return { ...this.state };
  }

  getHistory(): HistoryEntry[] {
    return [...this.history];
  }

  getSeed(): number {
    return this.state.config.seed!;
  }

  setInvestments(investments: InvestmentAllocation): void {
    this.state.investments = { ...investments };
  }

  setPolicyParams(params: Partial<PolicyParameters>): void {
    this.state.policyParams = { ...this.state.policyParams, ...params };
  }

  reset(): void {
    const seed = this.state.config.seed;
    this.rng = new SeededRandom(seed);

    const cohorts = createInitialCohorts();
    const capability = calculateNationalCapability(cohorts);

    this.state = {
      ...this.state,
      year: 0,
      entities: cohorts,
      capability,
      capabilityNormalized: this.normalizeToDeviation(capability),
      totalTalent: this.calculateTotalTalent(cohorts),
      successionScore: this.calculateSuccessionScore(cohorts),
    };

    this.history = [];
    this.recordHistory();
  }

  // ============================================
  // Main Simulation Step
  // ============================================

  simulateYear(): void {
    const { entities: cohorts, investments, policyParams } = this.state;

    // 1. Apply population dynamics (inflow/outflow)
    const updatedCohorts = this.applyPopulationDynamics(cohorts, policyParams);

    // 2. Apply skill growth based on investments
    const grownCohorts = this.applySkillGrowth(updatedCohorts, investments);

    // 3. Apply skill decay
    const decayedCohorts = this.applySkillDecay(grownCohorts);

    // 4. Apply transitions
    const transitionedCohorts = this.applyTransitions(decayedCohorts);

    // 5. Update capability
    const capability = calculateNationalCapability(transitionedCohorts);

    // 6. Update state
    this.state = {
      ...this.state,
      year: this.state.year + 1,
      entities: transitionedCohorts,
      capability,
      capabilityNormalized: this.normalizeToDeviation(capability),
      totalTalent: this.calculateTotalTalent(transitionedCohorts),
      successionScore: this.calculateSuccessionScore(transitionedCohorts),
    };

    this.recordHistory();
  }

  simulateYears(years: number): SimulationResult {
    for (let i = 0; i < years; i++) {
      this.simulateYear();
    }

    return this.getResult();
  }

  getResult(): SimulationResult {
    const scores = this.history.map(h => h.totalScore);

    return {
      finalState: this.getState(),
      history: this.getHistory(),
      statistics: {
        avgScore: scores.reduce((a, b) => a + b, 0) / scores.length,
        minScore: Math.min(...scores),
        maxScore: Math.max(...scores),
        scoreGrowth: scores.length > 1 ? scores[scores.length - 1] - scores[0] : 0,
      },
    };
  }

  // ============================================
  // Population Dynamics
  // ============================================

  private applyPopulationDynamics(cohorts: Cohort[], params: PolicyParameters): Cohort[] {
    const currentYear = this.state.config.baseYear + this.state.year;
    const declineFactor = this.getPopulationDeclineFactor(currentYear);

    // Calculate new entrants
    const baseInflow = POPULATION_STATS.age22Population *
                       POPULATION_STATS.universityEnrollmentRate *
                       declineFactor;

    const masterInflow = baseInflow * (params.masterEnrollment / 100);
    const phdInflow = masterInflow * (params.phdEnrollment / 100);

    return cohorts.map(cohort => {
      const updated = { ...cohort, skills: { ...cohort.skills } };

      // Add inflow to entry-level cohorts
      if (cohort.id === 'master_student') {
        updated.count = Math.round(cohort.count * 0.5 + masterInflow * 0.5);
      } else if (cohort.id === 'phd_student') {
        updated.count = Math.round(cohort.count * 0.7 + phdInflow * 0.3);
      } else if (cohort.id === 'ind_junior') {
        // Industry gets graduates not going to graduate school
        const industryInflow = baseInflow * 0.4 * (1 - params.masterEnrollment / 100);
        updated.count = Math.round(cohort.count * 0.9 + industryInflow * 0.1);
      }

      // Age cohorts
      updated.avgAge += 1;
      updated.avgTenure += 1;

      return updated;
    });
  }

  private getPopulationDeclineFactor(year: number): number {
    const projYears = Object.keys(POPULATION_STATS.projections)
      .map(Number)
      .sort((a, b) => a - b);

    for (let i = projYears.length - 1; i >= 0; i--) {
      if (year >= projYears[i]) {
        return POPULATION_STATS.projections[projYears[i]];
      }
    }
    return 1.0;
  }

  // ============================================
  // Skill Growth
  // ============================================

  private applySkillGrowth(cohorts: Cohort[], investments: InvestmentAllocation): Cohort[] {
    return cohorts.map(cohort => {
      const updated = { ...cohort, skills: { ...cohort.skills } };
      const sectorInvestment = investments[cohort.sector] / 100;
      const growthMap = SECTOR_GROWTH_MAP[cohort.sector];

      for (const axisKey of CAPABILITY_AXIS_KEYS) {
        const skill = { ...updated.skills[axisKey] };
        const growthMultiplier = growthMap[axisKey] ?? 0.5;

        // Growth = investment × sector multiplier × age efficiency
        const ageEfficiency = this.calculateAgeEfficiency(cohort.avgAge);
        const growth = sectorInvestment * growthMultiplier * ageEfficiency;

        // Add stochastic component if enabled
        const noise = this.state.config.enableStochasticity
          ? (this.rng.next() - 0.5) * 0.5
          : 0;

        skill.mean = Math.min(100, Math.max(0, skill.mean + growth + noise));
        updated.skills[axisKey] = skill;
      }

      return updated;
    });
  }

  private calculateAgeEfficiency(age: number): number {
    const { AGE_EFFICIENCY_MIN, AGE_EFFICIENCY_BASE_AGE, AGE_EFFICIENCY_RANGE } = SIMULATION_CONSTANTS;
    return Math.max(AGE_EFFICIENCY_MIN, 1 - (age - AGE_EFFICIENCY_BASE_AGE) / AGE_EFFICIENCY_RANGE);
  }

  // ============================================
  // Skill Decay
  // ============================================

  private applySkillDecay(cohorts: Cohort[]): Cohort[] {
    return cohorts.map(cohort => {
      const updated = { ...cohort, skills: { ...cohort.skills } };

      for (const axisKey of CAPABILITY_AXIS_KEYS) {
        const skill = { ...updated.skills[axisKey] };
        const decayRate = getDecayRate(axisKey);

        skill.mean = Math.max(0, skill.mean - decayRate);
        updated.skills[axisKey] = skill;
      }

      return updated;
    });
  }

  // ============================================
  // Transitions
  // ============================================

  private applyTransitions(cohorts: Cohort[]): Cohort[] {
    // Simplified: just apply retirement for senior cohorts
    return cohorts.map(cohort => {
      const updated = { ...cohort };

      if (cohort.avgTenure >= cohort.maxTenure * 0.8) {
        // Natural attrition
        const attritionRate = 0.05 + (cohort.avgTenure / cohort.maxTenure) * 0.1;
        updated.count = Math.round(cohort.count * (1 - attritionRate));
      }

      return updated;
    });
  }

  // ============================================
  // Succession Score
  // ============================================

  private calculateSuccessionScore(cohorts: Cohort[]): number {
    const sectorScores: Record<SectorKey, number> = {
      university: 0,
      industry: 0,
      government: 0,
      research: 0,
    };

    const sectorCohorts: Record<SectorKey, Cohort[]> = {
      university: [],
      industry: [],
      government: [],
      research: [],
    };

    for (const cohort of cohorts) {
      sectorCohorts[cohort.sector].push(cohort);
    }

    for (const sector of Object.keys(sectorCohorts) as SectorKey[]) {
      const sectorC = sectorCohorts[sector];
      if (sectorC.length === 0) continue;

      // Age diversity score
      const ages = sectorC.map(c => c.avgAge);
      const ageRange = Math.max(...ages) - Math.min(...ages);
      const ageDiversityScore = Math.min(100, (ageRange / 40) * 100);

      // Tenure margin score
      const tenureMargins = sectorC.map(c => (c.maxTenure - c.avgTenure) / c.maxTenure);
      const avgMargin = tenureMargins.reduce((a, b) => a + b, 0) / tenureMargins.length;
      const tenureScore = avgMargin * 100;

      // Senior mentor availability
      const totalCount = sectorC.reduce((sum, c) => sum + c.count, 0);
      const seniorCount = sectorC
        .filter(c => c.role.includes('シニア') || c.role.includes('教授') || c.role.includes('幹部'))
        .reduce((sum, c) => sum + c.count, 0);
      const mentorScore = Math.min(100, (seniorCount / totalCount) * 300);

      sectorScores[sector] = ageDiversityScore * 0.3 + tenureScore * 0.4 + mentorScore * 0.3;
    }

    // Average across sectors
    const scores = Object.values(sectorScores);
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  }

  // ============================================
  // Utility Methods
  // ============================================

  private calculateTotalTalent(cohorts: Cohort[]): number {
    return cohorts.reduce((sum, c) => sum + c.count, 0);
  }

  private normalizeToDeviation(capability: SkillVector): SkillVector {
    // Calculate global mean and std
    const values = CAPABILITY_AXIS_KEYS.map(k => capability[k]);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
    const std = Math.sqrt(variance) || 10;

    return normalizeCapability(capability, { mean, std });
  }

  private recordHistory(): void {
    const { year, capability, capabilityNormalized, investments, totalTalent, successionScore } = this.state;

    this.history.push({
      year,
      capability: { ...capability },
      capabilityNormalized: { ...capabilityNormalized },
      totalScore: calculateTotalScore(capability),
      successionScore,
      totalTalent,
      investments: { ...investments },
    });
  }
}
