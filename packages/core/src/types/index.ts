/**
 * Human Resource Simulator - Core Type Definitions
 * 国家人材育成シミュレーター 型定義
 */

// ============================================
// Simulation Constants (Magic Numbers Extracted)
// ============================================

export const SIMULATION_CONSTANTS = {
  /** CES関数の弾力性パラメータ (α < 1 で補完性を表現) */
  CES_EXPONENT: 0.8,
  /** キーパーソンの上位パーセンタイル (95%タイル = 1.645σ) */
  KEY_PERSON_Z_SCORE: 1.645,
  /** キーパーソンの人口比率 (上位5%) */
  KEY_PERSON_RATIO: 0.05,
  /** 総合スコアの平均重み */
  SCORE_AVG_WEIGHT: 0.6,
  /** 総合スコアの最小値重み (弱点ペナルティ) */
  SCORE_MIN_WEIGHT: 0.4,
  /** デジタル/AI軸の減衰率 (技術陳腐化が速い) */
  DIGITAL_AI_DECAY: 1.5,
  /** 標準的な減衰率 */
  STANDARD_DECAY: 0.3,
  /** 年齢効率の最小値 */
  AGE_EFFICIENCY_MIN: 0.3,
  /** 年齢効率の基準年齢 */
  AGE_EFFICIENCY_BASE_AGE: 22,
  /** 年齢効率の減衰範囲 */
  AGE_EFFICIENCY_RANGE: 60,
  /** 偏差値計算の基準値 */
  DEVIATION_BASE: 50,
  /** 偏差値計算のスケール */
  DEVIATION_SCALE: 10,
} as const;

// ============================================
// Capability Axes (12次元能力ベクトル)
// ============================================

export const CAPABILITY_AXIS_KEYS = [
  'basicScience',
  'appliedTech',
  'digitalAI',
  'manufacturing',
  'finance',
  'energy',
  'globalCompete',
  'innovation',
  'education',
  'policyMaking',
  'implementation',
  'succession',
] as const;

export type CapabilityAxisKey = (typeof CAPABILITY_AXIS_KEYS)[number];

export interface CapabilityAxisDefinition {
  key: CapabilityAxisKey;
  name: string;
  nameEn: string;
  color: string;
  description: string;
}

export const CAPABILITY_AXES: CapabilityAxisDefinition[] = [
  { key: 'basicScience', name: '基礎科学', nameEn: 'Basic Science', color: '#8884d8', description: '基礎研究・理論的知識' },
  { key: 'appliedTech', name: '応用技術', nameEn: 'Applied Technology', color: '#82ca9d', description: '実用的技術実装能力' },
  { key: 'digitalAI', name: 'デジタル・AI', nameEn: 'Digital/AI', color: '#ffc658', description: '先端コンピューティング・AI能力' },
  { key: 'manufacturing', name: '製造・ものづくり', nameEn: 'Manufacturing', color: '#ff7300', description: '生産・製造技術' },
  { key: 'finance', name: '金融・経済', nameEn: 'Finance/Economics', color: '#00C49F', description: '金融・経済専門知識' },
  { key: 'energy', name: 'エネルギー・環境', nameEn: 'Energy/Environment', color: '#FF8042', description: 'サステナビリティ・エネルギー知識' },
  { key: 'globalCompete', name: '国際競争力', nameEn: 'Global Competitiveness', color: '#0088FE', description: 'グローバル市場でのポジショニング能力' },
  { key: 'innovation', name: 'イノベーション', nameEn: 'Innovation', color: '#00C49F', description: '創造的問題解決・ブレークスルー思考' },
  { key: 'education', name: '教育基盤', nameEn: 'Education Foundation', color: '#FFBB28', description: '次世代育成能力' },
  { key: 'policyMaking', name: '政策立案', nameEn: 'Policy Making', color: '#FF8042', description: '政府政策策定能力' },
  { key: 'implementation', name: '社会実装力', nameEn: 'Social Implementation', color: '#8884d8', description: '実社会での展開・適用能力' },
  { key: 'succession', name: '技術継承', nameEn: 'Technical Succession', color: '#82ca9d', description: '知識・技術の世代間移転' },
];

// ============================================
// Sectors (4セクター)
// ============================================

export const SECTOR_KEYS = ['university', 'industry', 'government', 'research'] as const;
export type SectorKey = (typeof SECTOR_KEYS)[number];

export interface SectorDefinition {
  key: SectorKey;
  name: string;
  nameEn: string;
  icon: string;
  color: string;
  /** このセクターで成長しやすい能力軸 */
  growthAxes: CapabilityAxisKey[];
  /** 成長倍率 */
  growthMultiplier: number;
}

export const SECTORS: SectorDefinition[] = [
  {
    key: 'university',
    name: '大学',
    nameEn: 'University',
    icon: '🎓',
    color: '#8b5cf6',
    growthAxes: ['basicScience', 'education', 'innovation'],
    growthMultiplier: 2.5,
  },
  {
    key: 'industry',
    name: '産業界',
    nameEn: 'Industry',
    icon: '🏭',
    color: '#10b981',
    growthAxes: ['appliedTech', 'manufacturing', 'digitalAI', 'implementation'],
    growthMultiplier: 3.0,
  },
  {
    key: 'government',
    name: '政府',
    nameEn: 'Government',
    icon: '🏛️',
    color: '#f59e0b',
    growthAxes: ['policyMaking', 'globalCompete'],
    growthMultiplier: 2.0,
  },
  {
    key: 'research',
    name: '研究機関',
    nameEn: 'Research Institute',
    icon: '🔬',
    color: '#3b82f6',
    growthAxes: ['basicScience', 'appliedTech', 'innovation', 'globalCompete'],
    growthMultiplier: 2.8,
  },
];

// ============================================
// Skill Distribution (確率分布)
// ============================================

export interface SkillDistribution {
  mean: number;
  std: number;
}

export type SkillVector = Record<CapabilityAxisKey, number>;
export type SkillDistributionVector = Record<CapabilityAxisKey, SkillDistribution>;

// ============================================
// Cohort Model (v3用コホートモデル)
// ============================================

export interface Cohort {
  id: string;
  sector: SectorKey;
  role: string;
  roleEn: string;
  count: number;
  avgAge: number;
  avgTenure: number;
  maxTenure: number;
  skills: SkillDistributionVector;
}

// ============================================
// Individual Model (v2用個人モデル)
// ============================================

export interface Individual {
  id: number;
  name: string;
  sector: SectorKey;
  role: string;
  age: number;
  tenure: number;
  maxTenure: number;
  skills: SkillVector;
  mentoring: number;
  successorCount: number;
}

// ============================================
// Investment & Policy Parameters
// ============================================

export type InvestmentAllocation = Record<SectorKey, number>;

export interface PolicyParameters {
  /** 修士進学率 (%) */
  masterEnrollment: number;
  /** 博士進学率 (%) */
  phdEnrollment: number;
  /** 博士→アカデミア率 (%) */
  phdToAcademia: number;
  /** 人口減少率 (年率%) */
  populationDeclineRate: number;
  /** 定年延長オプション */
  retirementAgeExtension: number;
}

export const DEFAULT_POLICY_PARAMS: PolicyParameters = {
  masterEnrollment: 12,
  phdEnrollment: 10,
  phdToAcademia: 18,
  populationDeclineRate: 1.2,
  retirementAgeExtension: 0,
};

export const DEFAULT_INVESTMENTS: InvestmentAllocation = {
  university: 30,
  industry: 35,
  government: 15,
  research: 20,
};

// ============================================
// Transition Rules (状態遷移)
// ============================================

export interface TransitionRule {
  from: string;
  to: string | 'exit' | 'retire';
  probability: number;
  condition?: {
    minAge?: number;
    maxAge?: number;
    minTenure?: number;
    skillRequirement?: Partial<SkillVector>;
  };
}

export interface CrossSectorTransition extends TransitionRule {
  /** 投資に対する感度 (-1 to 1: 負 = 投資増で転出減) */
  investmentSensitivity?: number;
}

// ============================================
// Simulation State
// ============================================

export interface SimulationConfig {
  mode: 'cohort' | 'individual' | 'hybrid';
  seed?: number;
  baseYear: number;
  enableStochasticity: boolean;
}

export interface SimulationState<T extends 'cohort' | 'individual' = 'cohort'> {
  year: number;
  entities: T extends 'cohort' ? Cohort[] : Individual[];
  capability: SkillVector;
  capabilityNormalized: SkillVector;
  investments: InvestmentAllocation;
  policyParams: PolicyParameters;
  totalTalent: number;
  successionScore: number;
  config: SimulationConfig;
}

// ============================================
// History & Results
// ============================================

export interface HistoryEntry {
  year: number;
  capability: SkillVector;
  capabilityNormalized: SkillVector;
  totalScore: number;
  successionScore: number;
  totalTalent: number;
  investments: InvestmentAllocation;
}

export interface SimulationResult {
  finalState: SimulationState;
  history: HistoryEntry[];
  statistics: {
    avgScore: number;
    minScore: number;
    maxScore: number;
    scoreGrowth: number;
  };
}

// ============================================
// Scenario Comparison
// ============================================

export interface Scenario {
  id: string;
  name: string;
  description: string;
  color: string;
  initialState: SimulationState;
  investments: InvestmentAllocation;
  policyParams: PolicyParameters;
  createdAt: string;
}

export interface ScenarioComparisonResult {
  scenarios: Scenario[];
  results: SimulationResult[];
  differences: {
    axisKey: CapabilityAxisKey;
    values: Record<string, number>;
    maxDiff: number;
  }[];
}

// ============================================
// Monte Carlo
// ============================================

export interface MonteCarloConfig {
  iterations: number;
  seed: number;
  years: number;
}

export interface MonteCarloResult {
  config: MonteCarloConfig;
  statistics: {
    mean: SkillVector;
    std: SkillVector;
    percentiles: {
      p5: SkillVector;
      p25: SkillVector;
      p50: SkillVector;
      p75: SkillVector;
      p95: SkillVector;
    };
  };
  outcomes: SimulationResult[];
}

// ============================================
// Export/Import
// ============================================

export interface ExportFormat {
  version: string;
  timestamp: string;
  checksum: string;
  seed?: number;
  state: SimulationState;
  history: HistoryEntry[];
}

// ============================================
// Optimization Advisor
// ============================================

export interface OptimizationRecommendation {
  suggestedInvestments: InvestmentAllocation;
  rationale: string[];
  projectedScoreImprovement: number;
  confidenceLevel: 'high' | 'medium' | 'low';
}

// ============================================
// Sensitivity Analysis
// ============================================

export interface SensitivityResult {
  parameter: string;
  baseValue: number;
  variations: {
    value: number;
    outcome: SkillVector;
    totalScore: number;
  }[];
  elasticity: number;
}
