import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, AreaChart, Area, ComposedChart } from 'recharts';

// ============================================
// 人口統計データ（簡易版）
// ============================================

const POPULATION_STATS = {
  // 基準年（2024年）
  baseYear: 2024,
  
  // 年齢別人口（万人）
  agePopulation: {
    age18: 110,  // 18歳人口（大学進学世代）
    age22: 115,  // 22歳人口（学部卒世代）
    age24: 118,  // 24歳人口（修士卒世代）
    age27: 120,  // 27歳人口（博士卒世代）
  },
  
  // 進学・就職率
  rates: {
    universityEnrollment: 0.56,    // 大学進学率 56%
    masterEnrollment: 0.12,        // 修士進学率 12%（学部卒のうち）
    phdEnrollment: 0.10,           // 博士進学率 10%（修士卒のうち）
    phdToAcademia: 0.18,           // 博士→アカデミア 18%
    phdToIndustry: 0.42,           // 博士→産業界 42%
    phdToResearch: 0.30,           // 博士→研究機関 30%
    masterToIndustry: 0.75,        // 修士→産業界 75%
    masterToGov: 0.12,             // 修士→官僚 12%
    bachelorToIndustry: 0.82,      // 学部→産業界 82%
    bachelorToGov: 0.08,           // 学部→官僚 8%
  },
  
  // 人口減少予測（基準年比）
  projections: {
    2025: 0.99,
    2030: 0.95,
    2035: 0.90,
    2040: 0.84,
    2045: 0.78,
    2050: 0.72,
  },
  
  // 年間減少率（18歳人口）
  annualDeclineRate: 0.012,  // 年1.2%減少
};

// 人口統計から年間流入数を計算
const calculateAnnualInflow = (year, stats, customRates = {}) => {
  const rates = { ...stats.rates, ...customRates };
  
  // 人口減少係数
  const currentYear = stats.baseYear + year;
  let declineFactor = 1;
  
  // 予測データがあればそれを使用、なければ年間減少率から計算
  const projectionYears = Object.keys(stats.projections).map(Number).sort((a, b) => a - b);
  for (let i = projectionYears.length - 1; i >= 0; i--) {
    if (currentYear >= projectionYears[i]) {
      declineFactor = stats.projections[projectionYears[i]];
      break;
    }
  }
  if (declineFactor === 1 && year > 0) {
    declineFactor = Math.pow(1 - stats.annualDeclineRate, year);
  }
  
  // 各世代の人口（万人→人に変換）
  const pop18 = stats.agePopulation.age18 * 10000 * declineFactor;
  const pop22 = stats.agePopulation.age22 * 10000 * declineFactor;
  const pop24 = stats.agePopulation.age24 * 10000 * declineFactor;
  const pop27 = stats.agePopulation.age27 * 10000 * declineFactor;
  
  // 各段階の人数計算
  const universityEntrants = pop18 * rates.universityEnrollment;           // 大学入学者
  const bachelorGraduates = pop22 * rates.universityEnrollment * 0.90;     // 学部卒業者（中退10%）
  const masterEntrants = bachelorGraduates * rates.masterEnrollment;       // 修士入学者
  const masterGraduates = masterEntrants * 0.92;                            // 修士修了者（中退8%）
  const phdEntrants = masterGraduates * rates.phdEnrollment;               // 博士入学者
  const phdGraduates = phdEntrants * 0.70;                                  // 博士修了者（中退30%）
  
  // 各セクターへの流入
  return {
    // 大学セクター
    master_student: Math.round(masterEntrants),
    phd_student: Math.round(phdEntrants),
    assist_prof: Math.round(phdGraduates * rates.phdToAcademia),
    
    // 産業界セクター
    ind_junior_from_bachelor: Math.round((bachelorGraduates - masterEntrants) * rates.bachelorToIndustry),
    ind_junior_from_master: Math.round(masterGraduates * (1 - rates.phdEnrollment) * rates.masterToIndustry),
    ind_junior_from_phd: Math.round(phdGraduates * rates.phdToIndustry),
    
    // 政府セクター
    gov_junior_from_bachelor: Math.round((bachelorGraduates - masterEntrants) * rates.bachelorToGov),
    gov_junior_from_master: Math.round(masterGraduates * (1 - rates.phdEnrollment) * rates.masterToGov),
    
    // 研究機関
    res_junior: Math.round(phdGraduates * rates.phdToResearch),
    
    // 統計情報
    _stats: {
      declineFactor,
      currentYear,
      pop18: Math.round(pop18),
      universityEntrants: Math.round(universityEntrants),
      bachelorGraduates: Math.round(bachelorGraduates),
      masterGraduates: Math.round(masterGraduates),
      phdGraduates: Math.round(phdGraduates),
    }
  };
};

// ============================================
// 定数定義
// ============================================

const CAPABILITY_AXES = [
  { key: 'basicScience', name: '基礎科学', short: '基礎' },
  { key: 'appliedTech', name: '応用技術', short: '応用' },
  { key: 'digitalAI', name: 'デジタル・AI', short: 'DX/AI' },
  { key: 'manufacturing', name: '製造・ものづくり', short: '製造' },
  { key: 'finance', name: '金融・経済', short: '金融' },
  { key: 'energy', name: 'エネルギー・環境', short: 'エネ' },
  { key: 'globalCompete', name: '国際競争力', short: '国際' },
  { key: 'innovation', name: 'イノベーション', short: '革新' },
  { key: 'education', name: '教育基盤', short: '教育' },
  { key: 'policyMaking', name: '政策立案', short: '政策' },
  { key: 'implementation', name: '社会実装力', short: '実装' },
  { key: 'succession', name: '技術継承性', short: '継承' },
];

const SECTORS = {
  university: { name: '大学', icon: '🎓', color: '#8b5cf6' },
  industry: { name: '産業界', icon: '🏭', color: '#3b82f6' },
  government: { name: '政府', icon: '🏛️', color: '#10b981' },
  research: { name: '研究機関', icon: '🔬', color: '#f59e0b' },
};

// 初期コホート定義
const createInitialCohorts = () => [
  // 大学セクター
  { 
    id: 'prof_senior', sector: 'university', role: 'シニア教授',
    count: 3000, avgAge: 58, avgTenure: 28, maxTenure: 40,
    skills: { basicScience: { mean: 85, std: 8 }, appliedTech: { mean: 55, std: 12 }, digitalAI: { mean: 35, std: 15 }, 
              manufacturing: { mean: 30, std: 10 }, finance: { mean: 25, std: 8 }, energy: { mean: 50, std: 12 },
              globalCompete: { mean: 65, std: 10 }, innovation: { mean: 60, std: 12 }, education: { mean: 80, std: 8 },
              policyMaking: { mean: 45, std: 12 }, implementation: { mean: 35, std: 10 }, succession: { mean: 75, std: 10 } }
  },
  { 
    id: 'prof_mid', sector: 'university', role: '中堅教授',
    count: 2000, avgAge: 45, avgTenure: 15, maxTenure: 40,
    skills: { basicScience: { mean: 75, std: 10 }, appliedTech: { mean: 50, std: 12 }, digitalAI: { mean: 45, std: 15 }, 
              manufacturing: { mean: 28, std: 10 }, finance: { mean: 22, std: 8 }, energy: { mean: 45, std: 12 },
              globalCompete: { mean: 55, std: 12 }, innovation: { mean: 55, std: 12 }, education: { mean: 70, std: 10 },
              policyMaking: { mean: 35, std: 12 }, implementation: { mean: 30, std: 10 }, succession: { mean: 55, std: 12 } }
  },
  { 
    id: 'assist_prof', sector: 'university', role: '助教・ポスドク',
    count: 10000, avgAge: 33, avgTenure: 4, maxTenure: 15,
    skills: { basicScience: { mean: 65, std: 12 }, appliedTech: { mean: 45, std: 12 }, digitalAI: { mean: 55, std: 15 }, 
              manufacturing: { mean: 25, std: 10 }, finance: { mean: 18, std: 8 }, energy: { mean: 40, std: 12 },
              globalCompete: { mean: 45, std: 15 }, innovation: { mean: 50, std: 12 }, education: { mean: 45, std: 12 },
              policyMaking: { mean: 20, std: 10 }, implementation: { mean: 25, std: 10 }, succession: { mean: 30, std: 12 } }
  },
  { 
    id: 'phd_student', sector: 'university', role: '博士課程',
    count: 15000, avgAge: 27, avgTenure: 2, maxTenure: 5,
    skills: { basicScience: { mean: 55, std: 15 }, appliedTech: { mean: 40, std: 12 }, digitalAI: { mean: 50, std: 18 }, 
              manufacturing: { mean: 22, std: 10 }, finance: { mean: 15, std: 8 }, energy: { mean: 35, std: 12 },
              globalCompete: { mean: 35, std: 15 }, innovation: { mean: 45, std: 15 }, education: { mean: 25, std: 12 },
              policyMaking: { mean: 12, std: 8 }, implementation: { mean: 20, std: 10 }, succession: { mean: 15, std: 10 } }
  },
  { 
    id: 'master_student', sector: 'university', role: '修士課程',
    count: 30000, avgAge: 24, avgTenure: 1, maxTenure: 2,
    skills: { basicScience: { mean: 45, std: 15 }, appliedTech: { mean: 35, std: 12 }, digitalAI: { mean: 45, std: 18 }, 
              manufacturing: { mean: 20, std: 10 }, finance: { mean: 12, std: 8 }, energy: { mean: 28, std: 12 },
              globalCompete: { mean: 28, std: 15 }, innovation: { mean: 38, std: 15 }, education: { mean: 15, std: 10 },
              policyMaking: { mean: 8, std: 6 }, implementation: { mean: 15, std: 10 }, succession: { mean: 8, std: 8 } }
  },
  
  // 産業界セクター
  { 
    id: 'ind_senior', sector: 'industry', role: 'シニアエンジニア',
    count: 50000, avgAge: 52, avgTenure: 4, maxTenure: 5,
    skills: { basicScience: { mean: 40, std: 12 }, appliedTech: { mean: 82, std: 8 }, digitalAI: { mean: 55, std: 15 }, 
              manufacturing: { mean: 78, std: 10 }, finance: { mean: 40, std: 12 }, energy: { mean: 50, std: 12 },
              globalCompete: { mean: 50, std: 12 }, innovation: { mean: 55, std: 12 }, education: { mean: 35, std: 12 },
              policyMaking: { mean: 30, std: 10 }, implementation: { mean: 80, std: 8 }, succession: { mean: 65, std: 12 } }
  },
  { 
    id: 'ind_mid', sector: 'industry', role: '中堅エンジニア',
    count: 150000, avgAge: 38, avgTenure: 3, maxTenure: 5,
    skills: { basicScience: { mean: 35, std: 12 }, appliedTech: { mean: 70, std: 10 }, digitalAI: { mean: 65, std: 15 }, 
              manufacturing: { mean: 68, std: 12 }, finance: { mean: 35, std: 12 }, energy: { mean: 42, std: 12 },
              globalCompete: { mean: 42, std: 12 }, innovation: { mean: 50, std: 12 }, education: { mean: 25, std: 10 },
              policyMaking: { mean: 22, std: 10 }, implementation: { mean: 72, std: 10 }, succession: { mean: 40, std: 12 } }
  },
  { 
    id: 'ind_junior', sector: 'industry', role: '若手エンジニア',
    count: 100000, avgAge: 28, avgTenure: 2, maxTenure: 5,
    skills: { basicScience: { mean: 32, std: 12 }, appliedTech: { mean: 55, std: 12 }, digitalAI: { mean: 68, std: 15 }, 
              manufacturing: { mean: 50, std: 15 }, finance: { mean: 28, std: 12 }, energy: { mean: 35, std: 12 },
              globalCompete: { mean: 38, std: 15 }, innovation: { mean: 48, std: 15 }, education: { mean: 15, std: 10 },
              policyMaking: { mean: 12, std: 8 }, implementation: { mean: 58, std: 12 }, succession: { mean: 18, std: 10 } }
  },
  
  // 政府セクター
  { 
    id: 'gov_executive', sector: 'government', role: '幹部官僚',
    count: 5000, avgAge: 55, avgTenure: 2, maxTenure: 3,
    skills: { basicScience: { mean: 30, std: 10 }, appliedTech: { mean: 35, std: 12 }, digitalAI: { mean: 32, std: 15 }, 
              manufacturing: { mean: 25, std: 10 }, finance: { mean: 72, std: 10 }, energy: { mean: 55, std: 12 },
              globalCompete: { mean: 55, std: 12 }, innovation: { mean: 35, std: 12 }, education: { mean: 30, std: 10 },
              policyMaking: { mean: 85, std: 8 }, implementation: { mean: 65, std: 10 }, succession: { mean: 30, std: 12 } }
  },
  { 
    id: 'gov_mid', sector: 'government', role: '中堅官僚',
    count: 20000, avgAge: 42, avgTenure: 2, maxTenure: 3,
    skills: { basicScience: { mean: 28, std: 10 }, appliedTech: { mean: 32, std: 12 }, digitalAI: { mean: 38, std: 15 }, 
              manufacturing: { mean: 22, std: 10 }, finance: { mean: 62, std: 12 }, energy: { mean: 48, std: 12 },
              globalCompete: { mean: 45, std: 12 }, innovation: { mean: 32, std: 12 }, education: { mean: 28, std: 10 },
              policyMaking: { mean: 72, std: 10 }, implementation: { mean: 58, std: 12 }, succession: { mean: 25, std: 10 } }
  },
  { 
    id: 'gov_junior', sector: 'government', role: '若手官僚',
    count: 25000, avgAge: 30, avgTenure: 1, maxTenure: 3,
    skills: { basicScience: { mean: 35, std: 12 }, appliedTech: { mean: 38, std: 12 }, digitalAI: { mean: 48, std: 15 }, 
              manufacturing: { mean: 20, std: 10 }, finance: { mean: 52, std: 15 }, energy: { mean: 40, std: 12 },
              globalCompete: { mean: 42, std: 15 }, innovation: { mean: 38, std: 15 }, education: { mean: 22, std: 10 },
              policyMaking: { mean: 55, std: 15 }, implementation: { mean: 48, std: 12 }, succession: { mean: 15, std: 10 } }
  },
  
  // 研究機関セクター
  { 
    id: 'res_senior', sector: 'research', role: 'シニア研究者',
    count: 10000, avgAge: 52, avgTenure: 7, maxTenure: 10,
    skills: { basicScience: { mean: 78, std: 10 }, appliedTech: { mean: 65, std: 12 }, digitalAI: { mean: 58, std: 15 }, 
              manufacturing: { mean: 35, std: 12 }, finance: { mean: 28, std: 10 }, energy: { mean: 65, std: 12 },
              globalCompete: { mean: 72, std: 10 }, innovation: { mean: 68, std: 10 }, education: { mean: 55, std: 12 },
              policyMaking: { mean: 42, std: 12 }, implementation: { mean: 48, std: 12 }, succession: { mean: 58, std: 12 } }
  },
  { 
    id: 'res_mid', sector: 'research', role: '中堅研究者',
    count: 25000, avgAge: 40, avgTenure: 5, maxTenure: 10,
    skills: { basicScience: { mean: 68, std: 12 }, appliedTech: { mean: 58, std: 12 }, digitalAI: { mean: 62, std: 15 }, 
              manufacturing: { mean: 32, std: 12 }, finance: { mean: 25, std: 10 }, energy: { mean: 58, std: 12 },
              globalCompete: { mean: 62, std: 12 }, innovation: { mean: 62, std: 12 }, education: { mean: 42, std: 12 },
              policyMaking: { mean: 35, std: 12 }, implementation: { mean: 42, std: 12 }, succession: { mean: 42, std: 12 } }
  },
  { 
    id: 'res_junior', sector: 'research', role: '若手研究者',
    count: 15000, avgAge: 32, avgTenure: 3, maxTenure: 10,
    skills: { basicScience: { mean: 58, std: 15 }, appliedTech: { mean: 50, std: 12 }, digitalAI: { mean: 65, std: 15 }, 
              manufacturing: { mean: 28, std: 12 }, finance: { mean: 22, std: 10 }, energy: { mean: 48, std: 15 },
              globalCompete: { mean: 52, std: 15 }, innovation: { mean: 55, std: 15 }, education: { mean: 32, std: 12 },
              policyMaking: { mean: 25, std: 12 }, implementation: { mean: 35, std: 12 }, succession: { mean: 25, std: 12 } }
  },
];

// 遷移行列
const TRANSITION_MATRIX = {
  master_student: { phd_student: 0.10, exit: 0.90 },  // 修士→博士は人口統計から別途
  phd_student: { assist_prof: 0.18, exit: 0.82 },     // 博士→助教は人口統計から
  assist_prof: { prof_mid: 0.08, ind_mid: 0.10, res_mid: 0.08, exit: 0.05 },
  prof_mid: { prof_senior: 0.05, exit: 0.02 },
  prof_senior: { retire: 0.03 },
  ind_junior: { ind_mid: 0.20, exit: 0.12 },
  ind_mid: { ind_senior: 0.12, exit: 0.08 },
  ind_senior: { retire: 0.08, exit: 0.05 },
  gov_junior: { gov_mid: 0.28, exit: 0.08 },
  gov_mid: { gov_executive: 0.08, exit: 0.10 },
  gov_executive: { retire: 0.18, exit: 0.08 },
  res_junior: { res_mid: 0.15, exit: 0.06 },
  res_mid: { res_senior: 0.10, exit: 0.04 },
  res_senior: { retire: 0.05, exit: 0.03 },
};

const TARGET_CAPABILITY = {
  basicScience: 80, appliedTech: 82, digitalAI: 85, manufacturing: 78,
  finance: 72, energy: 78, globalCompete: 75, innovation: 80,
  education: 78, policyMaking: 70, implementation: 80, succession: 82,
};

// ============================================
// ユーティリティ関数
// ============================================

const standardize = (value, mean, std) => {
  if (std === 0) return 50;
  return 50 + 10 * ((value - mean) / std);
};

const calculateGlobalStats = (cohorts) => {
  const stats = {};
  CAPABILITY_AXES.forEach(axis => {
    let totalSum = 0;
    let totalCount = 0;
    let values = [];
    
    cohorts.forEach(cohort => {
      const skill = cohort.skills[axis.key];
      totalSum += skill.mean * cohort.count;
      totalCount += cohort.count;
      for (let i = 0; i < Math.min(100, cohort.count / 1000); i++) {
        values.push(skill.mean + (Math.random() - 0.5) * 2 * skill.std);
      }
    });
    
    const globalMean = totalSum / totalCount;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - globalMean, 2), 0) / values.length;
    
    stats[axis.key] = { mean: globalMean, std: Math.sqrt(variance) || 10 };
  });
  return stats;
};

const calculateNationalCapability = (cohorts, globalStats) => {
  const capability = {};
  const rawCapability = {};
  
  CAPABILITY_AXES.forEach(axis => {
    let weightedSum = 0;
    let totalWeight = 0;
    let keyPersonContribution = 0;
    
    cohorts.forEach(cohort => {
      const skill = cohort.skills[axis.key];
      const weight = cohort.count;
      weightedSum += Math.pow(skill.mean, 0.8) * weight;
      totalWeight += weight;
      const keyPersons = cohort.count * 0.05;
      const keyPersonSkill = skill.mean + 1.645 * skill.std;
      keyPersonContribution += keyPersons * keyPersonSkill * 0.1;
    });
    
    const cesValue = Math.pow(weightedSum / totalWeight, 1/0.8);
    const rawValue = cesValue + keyPersonContribution / totalWeight;
    rawCapability[axis.key] = Math.min(100, Math.max(0, rawValue));
    capability[axis.key] = standardize(rawValue, globalStats[axis.key]?.mean || 50, globalStats[axis.key]?.std || 10);
  });
  
  return { normalized: capability, raw: rawCapability };
};

const calculateSuccessionScore = (cohorts) => {
  const sectorScores = {};
  
  Object.keys(SECTORS).forEach(sector => {
    const sectorCohorts = cohorts.filter(c => c.sector === sector);
    if (sectorCohorts.length === 0) { sectorScores[sector] = 0; return; }
    
    const ages = sectorCohorts.map(c => c.avgAge);
    const ageRange = Math.max(...ages) - Math.min(...ages);
    const ageScore = Math.min(40, ageRange) / 40 * 100;
    
    const tenureMargin = sectorCohorts.reduce((sum, c) => {
      return sum + (c.maxTenure - c.avgTenure) / c.maxTenure * c.count;
    }, 0) / sectorCohorts.reduce((sum, c) => sum + c.count, 0);
    const tenureScore = tenureMargin * 100;
    
    const totalCount = sectorCohorts.reduce((sum, c) => sum + c.count, 0);
    const seniorCount = sectorCohorts
      .filter(c => c.role.includes('シニア') || c.role.includes('教授') || c.role.includes('幹部'))
      .reduce((sum, c) => sum + c.count, 0);
    const mentorScore = Math.min(100, (seniorCount / totalCount) * 300);
    
    sectorScores[sector] = (ageScore * 0.3 + tenureScore * 0.4 + mentorScore * 0.3);
  });
  
  return {
    total: Object.values(sectorScores).reduce((a, b) => a + b, 0) / Object.keys(sectorScores).length,
    bySector: sectorScores,
  };
};

const calculateTotalScore = (capability) => {
  const values = Object.values(capability);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const min = Math.min(...values);
  return avg * 0.6 + min * 0.4;
};

// ============================================
// メインコンポーネント
// ============================================

export default function TalentSimulatorV3() {
  const [year, setYear] = useState(0);
  const [cohorts, setCohorts] = useState(createInitialCohorts);
  const [history, setHistory] = useState([]);
  const [inflowHistory, setInflowHistory] = useState([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [viewMode, setViewMode] = useState('normalized');
  
  // 投資配分
  const [investments, setInvestments] = useState({
    university: 30, industry: 35, government: 15, research: 20,
  });
  
  // 人口統計パラメータ（編集可能）
  const [popParams, setPopParams] = useState({
    masterEnrollment: POPULATION_STATS.rates.masterEnrollment * 100,
    phdEnrollment: POPULATION_STATS.rates.phdEnrollment * 100,
    phdToAcademia: POPULATION_STATS.rates.phdToAcademia * 100,
  });
  
  // 現在の流入数
  const currentInflow = useMemo(() => {
    const customRates = {
      masterEnrollment: popParams.masterEnrollment / 100,
      phdEnrollment: popParams.phdEnrollment / 100,
      phdToAcademia: popParams.phdToAcademia / 100,
    };
    return calculateAnnualInflow(year, POPULATION_STATS, customRates);
  }, [year, popParams]);
  
  // 統計計算
  const globalStats = useMemo(() => calculateGlobalStats(cohorts), [cohorts]);
  const { normalized: capabilityNorm, raw: capabilityRaw } = useMemo(
    () => calculateNationalCapability(cohorts, globalStats), [cohorts, globalStats]
  );
  const capability = viewMode === 'normalized' ? capabilityNorm : capabilityRaw;
  const successionScore = useMemo(() => calculateSuccessionScore(cohorts), [cohorts]);
  
  const totalTalent = useMemo(() => cohorts.reduce((sum, c) => sum + c.count, 0), [cohorts]);
  const sectorCounts = useMemo(() => {
    const counts = {};
    Object.keys(SECTORS).forEach(s => {
      counts[s] = cohorts.filter(c => c.sector === s).reduce((sum, c) => sum + c.count, 0);
    });
    return counts;
  }, [cohorts]);

  // シミュレーション1年分
  const simulateYear = useCallback(() => {
    const customRates = {
      masterEnrollment: popParams.masterEnrollment / 100,
      phdEnrollment: popParams.phdEnrollment / 100,
      phdToAcademia: popParams.phdToAcademia / 100,
    };
    const inflow = calculateAnnualInflow(year, POPULATION_STATS, customRates);
    
    setCohorts(prev => {
      let newCohorts = prev.map(cohort => {
        const newCohort = {
          ...cohort,
          skills: { ...cohort.skills },
          avgTenure: cohort.avgTenure + 1,
          avgAge: cohort.avgAge + 1,
        };
        
        const sectorInv = investments[cohort.sector] / 100;
        
        Object.keys(newCohort.skills).forEach(key => {
          const skill = { ...newCohort.skills[key] };
          let growth = 0;
          
          if (cohort.sector === 'university') {
            if (['basicScience', 'education', 'innovation'].includes(key)) growth = sectorInv * 2.5;
          } else if (cohort.sector === 'industry') {
            if (['appliedTech', 'manufacturing', 'digitalAI', 'implementation'].includes(key)) growth = sectorInv * 3;
          } else if (cohort.sector === 'government') {
            if (['policyMaking', 'finance', 'implementation'].includes(key)) growth = sectorInv * 2;
          } else if (cohort.sector === 'research') {
            if (['basicScience', 'globalCompete', 'innovation', 'energy'].includes(key)) growth = sectorInv * 2.5;
          }
          
          if (key === 'succession') growth = cohort.avgTenure * 0.3;
          const decay = key === 'digitalAI' ? 1.5 : 0.3;
          
          skill.mean = Math.max(0, Math.min(100, skill.mean + growth - decay + (Math.random() - 0.5)));
          newCohort.skills[key] = skill;
        });
        
        return newCohort;
      });
      
      // 内部遷移（昇進・退職）
      const flowChanges = {};
      newCohorts.forEach(cohort => {
        const transitions = TRANSITION_MATRIX[cohort.id];
        if (!transitions) return;
        
        Object.entries(transitions).forEach(([targetId, rate]) => {
          const flowCount = Math.floor(cohort.count * rate * (0.9 + Math.random() * 0.2));
          if (targetId === 'exit' || targetId === 'retire') {
            flowChanges[cohort.id] = (flowChanges[cohort.id] || 0) - flowCount;
          } else {
            flowChanges[cohort.id] = (flowChanges[cohort.id] || 0) - flowCount;
            flowChanges[targetId] = (flowChanges[targetId] || 0) + flowCount;
          }
        });
      });
      
      // 人口統計からの新規流入
      flowChanges['master_student'] = (flowChanges['master_student'] || 0) + inflow.master_student;
      flowChanges['phd_student'] = (flowChanges['phd_student'] || 0) + inflow.phd_student;
      flowChanges['assist_prof'] = (flowChanges['assist_prof'] || 0) + inflow.assist_prof;
      flowChanges['ind_junior'] = (flowChanges['ind_junior'] || 0) + 
        inflow.ind_junior_from_bachelor + inflow.ind_junior_from_master + inflow.ind_junior_from_phd;
      flowChanges['gov_junior'] = (flowChanges['gov_junior'] || 0) + 
        inflow.gov_junior_from_bachelor + inflow.gov_junior_from_master;
      flowChanges['res_junior'] = (flowChanges['res_junior'] || 0) + inflow.res_junior;
      
      newCohorts = newCohorts.map(cohort => ({
        ...cohort,
        count: Math.max(100, cohort.count + (flowChanges[cohort.id] || 0)),
      }));
      
      return newCohorts;
    });
    
    // 流入履歴記録
    setInflowHistory(prev => [...prev, {
      year: year + 1,
      ...inflow._stats,
      masterInflow: inflow.master_student,
      phdInflow: inflow.phd_student,
      industryInflow: inflow.ind_junior_from_bachelor + inflow.ind_junior_from_master + inflow.ind_junior_from_phd,
      govInflow: inflow.gov_junior_from_bachelor + inflow.gov_junior_from_master,
      researchInflow: inflow.res_junior,
    }]);
    
    setYear(prev => prev + 1);
  }, [investments, popParams, year]);
  
  // 履歴更新
  useEffect(() => {
    const entry = {
      year,
      ...capabilityNorm,
      rawScore: calculateTotalScore(capabilityRaw),
      normScore: calculateTotalScore(capabilityNorm),
      succession: successionScore.total,
      totalTalent,
    };
    setHistory(prev => [...prev, entry]);
  }, [year, capabilityNorm, capabilityRaw, successionScore, totalTalent]);
  
  // 自動シミュレーション
  useEffect(() => {
    if (isSimulating && year < 30) {
      const timer = setTimeout(simulateYear, 600);
      return () => clearTimeout(timer);
    } else if (year >= 30) {
      setIsSimulating(false);
    }
  }, [isSimulating, year, simulateYear]);
  
  // 将来予測
  const predictFuture = (years) => {
    const recent = history.slice(-5);
    if (recent.length < 2) return capability;
    const prediction = {};
    CAPABILITY_AXES.forEach(axis => {
      const values = recent.map(h => h[axis.key] || 50);
      const trend = (values[values.length - 1] - values[0]) / values.length;
      prediction[axis.key] = Math.max(0, Math.min(100, capability[axis.key] + trend * years));
    });
    return prediction;
  };
  
  const future5 = predictFuture(5);
  const future10 = predictFuture(10);
  
  // レーダーチャートデータ
  const radarData = CAPABILITY_AXES.map(axis => ({
    axis: axis.short,
    current: capability[axis.key] || 50,
    target: viewMode === 'normalized' ? 50 : TARGET_CAPABILITY[axis.key],
  }));
  
  const futureRadarData = CAPABILITY_AXES.map(axis => ({
    axis: axis.short,
    current: capability[axis.key] || 50,
    year5: future5[axis.key] || 50,
    year10: future10[axis.key] || 50,
  }));
  
  const sectorData = Object.entries(SECTORS).map(([key, sector]) => ({
    name: sector.name,
    count: sectorCounts[key],
    color: sector.color,
  }));
  
  const resetSimulation = () => {
    setYear(0);
    setCohorts(createInitialCohorts());
    setHistory([]);
    setInflowHistory([]);
    setIsSimulating(false);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-3">
      <h1 className="text-2xl font-bold text-center mb-1 text-cyan-400">
        🌏 国家人材育成シミュレーター v3
      </h1>
      <p className="text-center text-gray-400 text-sm mb-3">
        人口統計連動 | {POPULATION_STATS.baseYear + year}年 | {(totalTalent/10000).toFixed(1)}万人
      </p>
      
      {/* ステータスバー */}
      <div className="grid grid-cols-6 gap-2 mb-4">
        <div className="bg-gray-800 rounded p-2 text-center">
          <div className="text-xl font-bold text-yellow-400">{POPULATION_STATS.baseYear + year}</div>
          <div className="text-gray-400 text-xs">年</div>
        </div>
        <div className="bg-gray-800 rounded p-2 text-center">
          <div className="text-xl font-bold text-cyan-400">{(totalTalent/10000).toFixed(1)}万</div>
          <div className="text-gray-400 text-xs">総人材</div>
        </div>
        <div className="bg-gray-800 rounded p-2 text-center">
          <div className="text-xl font-bold text-blue-400">{calculateTotalScore(capabilityRaw).toFixed(0)}</div>
          <div className="text-gray-400 text-xs">国力(実値)</div>
        </div>
        <div className="bg-gray-800 rounded p-2 text-center">
          <div className="text-xl font-bold text-purple-400">{calculateTotalScore(capabilityNorm).toFixed(0)}</div>
          <div className="text-gray-400 text-xs">国力(偏差値)</div>
        </div>
        <div className="bg-gray-800 rounded p-2 text-center">
          <div className="text-xl font-bold text-red-400">{(currentInflow._stats.declineFactor * 100).toFixed(0)}%</div>
          <div className="text-gray-400 text-xs">人口係数</div>
        </div>
        <div className="bg-gray-800 rounded p-2 text-center">
          <button
            onClick={() => setViewMode(v => v === 'normalized' ? 'raw' : 'normalized')}
            className={`text-xs px-2 py-1 rounded ${viewMode === 'normalized' ? 'bg-purple-600' : 'bg-blue-600'}`}
          >
            {viewMode === 'normalized' ? '偏差値' : '実値'}
          </button>
        </div>
      </div>

      {/* 人口統計パネル */}
      <div className="bg-gray-800 rounded p-3 mb-4">
        <h2 className="text-sm font-bold mb-2 text-green-300">📊 人口統計・流入パラメータ</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 現在の人口統計 */}
          <div className="bg-gray-700 rounded p-2">
            <div className="text-xs text-gray-400 mb-1">18歳人口（大学世代）</div>
            <div className="text-lg font-bold text-cyan-400">
              {(currentInflow._stats.pop18 / 10000).toFixed(1)}万人
            </div>
            <div className="text-xs text-gray-500">
              基準: {POPULATION_STATS.agePopulation.age18}万 × {(currentInflow._stats.declineFactor * 100).toFixed(0)}%
            </div>
          </div>
          
          <div className="bg-gray-700 rounded p-2">
            <div className="text-xs text-gray-400 mb-1">年間大学入学者</div>
            <div className="text-lg font-bold text-blue-400">
              {(currentInflow._stats.universityEntrants / 10000).toFixed(1)}万人
            </div>
            <div className="text-xs text-gray-500">進学率: {(POPULATION_STATS.rates.universityEnrollment * 100).toFixed(0)}%</div>
          </div>
          
          <div className="bg-gray-700 rounded p-2">
            <div className="text-xs text-gray-400 mb-1">年間修士入学</div>
            <div className="text-lg font-bold text-purple-400">
              {(currentInflow.master_student / 1000).toFixed(1)}千人
            </div>
          </div>
          
          <div className="bg-gray-700 rounded p-2">
            <div className="text-xs text-gray-400 mb-1">年間博士修了</div>
            <div className="text-lg font-bold text-orange-400">
              {(currentInflow._stats.phdGraduates / 1000).toFixed(1)}千人
            </div>
          </div>
        </div>
        
        {/* 進学率調整スライダー */}
        <div className="grid grid-cols-3 gap-4 mt-3">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span>修士進学率</span>
              <span className="text-yellow-400">{popParams.masterEnrollment.toFixed(0)}%</span>
            </div>
            <input
              type="range" min="5" max="30" value={popParams.masterEnrollment}
              onChange={(e) => setPopParams(p => ({...p, masterEnrollment: parseFloat(e.target.value)}))}
              className="w-full h-1.5 bg-gray-600 rounded-lg appearance-none cursor-pointer"
            />
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span>博士進学率</span>
              <span className="text-yellow-400">{popParams.phdEnrollment.toFixed(0)}%</span>
            </div>
            <input
              type="range" min="3" max="25" value={popParams.phdEnrollment}
              onChange={(e) => setPopParams(p => ({...p, phdEnrollment: parseFloat(e.target.value)}))}
              className="w-full h-1.5 bg-gray-600 rounded-lg appearance-none cursor-pointer"
            />
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span>博士→アカデミア</span>
              <span className="text-yellow-400">{popParams.phdToAcademia.toFixed(0)}%</span>
            </div>
            <input
              type="range" min="10" max="40" value={popParams.phdToAcademia}
              onChange={(e) => setPopParams(p => ({...p, phdToAcademia: parseFloat(e.target.value)}))}
              className="w-full h-1.5 bg-gray-600 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>
        
        {/* セクター別年間流入 */}
        <div className="grid grid-cols-4 gap-2 mt-3">
          {[
            { label: '🎓 大学', value: currentInflow.master_student + currentInflow.phd_student, color: 'text-purple-400' },
            { label: '🏭 産業界', value: currentInflow.ind_junior_from_bachelor + currentInflow.ind_junior_from_master + currentInflow.ind_junior_from_phd, color: 'text-blue-400' },
            { label: '🏛️ 政府', value: currentInflow.gov_junior_from_bachelor + currentInflow.gov_junior_from_master, color: 'text-green-400' },
            { label: '🔬 研究', value: currentInflow.res_junior, color: 'text-orange-400' },
          ].map(item => (
            <div key={item.label} className="bg-gray-600 rounded p-2 text-center">
              <div className="text-xs text-gray-300">{item.label} 年間流入</div>
              <div className={`text-sm font-bold ${item.color}`}>
                {item.value > 10000 ? `${(item.value/10000).toFixed(1)}万` : `${(item.value/1000).toFixed(1)}千`}人
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* レーダーチャート */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4">
        <div className="bg-gray-800 rounded p-3">
          <h2 className="text-sm font-bold mb-1 text-cyan-300">📊 現在の国力</h2>
          <ResponsiveContainer width="100%" height={250}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#444" />
              <PolarAngleAxis dataKey="axis" tick={{ fill: '#aaa', fontSize: 9 }} />
              <PolarRadiusAxis angle={30} domain={viewMode === 'normalized' ? [20, 80] : [0, 100]} tick={{ fill: '#666', fontSize: 8 }} />
              <Radar name="現在" dataKey="current" stroke="#00ffff" fill="#00ffff" fillOpacity={0.3} strokeWidth={2} />
              <Legend wrapperStyle={{ fontSize: '10px' }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-gray-800 rounded p-3">
          <h2 className="text-sm font-bold mb-1 text-orange-300">🔮 5年後・10年後</h2>
          <ResponsiveContainer width="100%" height={250}>
            <RadarChart data={futureRadarData}>
              <PolarGrid stroke="#444" />
              <PolarAngleAxis dataKey="axis" tick={{ fill: '#aaa', fontSize: 9 }} />
              <PolarRadiusAxis angle={30} domain={viewMode === 'normalized' ? [20, 80] : [0, 100]} tick={{ fill: '#666', fontSize: 8 }} />
              <Radar name="現在" dataKey="current" stroke="#00ffff" fill="#00ffff" fillOpacity={0.15} />
              <Radar name="5年後" dataKey="year5" stroke="#ffd700" fill="#ffd700" fillOpacity={0.2} />
              <Radar name="10年後" dataKey="year10" stroke="#ff4500" fill="#ff4500" fillOpacity={0.2} />
              <Legend wrapperStyle={{ fontSize: '10px' }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-gray-800 rounded p-3">
          <h2 className="text-sm font-bold mb-1 text-green-300">👥 セクター別人員</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={sectorData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#444" />
              <XAxis type="number" tick={{ fill: '#888', fontSize: 9 }} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#aaa', fontSize: 10 }} width={55} />
              <Tooltip contentStyle={{ backgroundColor: '#333', border: 'none', fontSize: '11px' }} 
                       formatter={(v) => `${(v/10000).toFixed(1)}万人`} />
              <Bar dataKey="count" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 投資 & 継承性 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4">
        <div className="bg-gray-800 rounded p-3">
          <h2 className="text-sm font-bold mb-2 text-green-300">💰 投資配分</h2>
          {Object.entries(SECTORS).map(([key, sector]) => (
            <div key={key} className="mb-2">
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm">{sector.icon} {sector.name}</span>
                <span className="text-yellow-400 font-bold">{investments[key]}%</span>
              </div>
              <input
                type="range" min="0" max="100" value={investments[key]}
                onChange={(e) => setInvestments(prev => ({...prev, [key]: parseInt(e.target.value)}))}
                className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          ))}
          <div className="flex justify-between mt-2 text-sm">
            <span>合計:</span>
            <span className={Object.values(investments).reduce((a,b)=>a+b,0) === 100 ? 'text-green-400' : 'text-red-400'}>
              {Object.values(investments).reduce((a,b)=>a+b,0)}%
            </span>
          </div>
        </div>

        <div className="bg-gray-800 rounded p-3">
          <h2 className="text-sm font-bold mb-2 text-orange-300">📊 継承性 & 人口推移</h2>
          {Object.entries(successionScore.bySector).map(([key, score]) => (
            <div key={key} className="flex items-center gap-2 mb-1">
              <span className="text-xs w-14">{SECTORS[key]?.icon} {SECTORS[key]?.name}</span>
              <div className="flex-1 bg-gray-600 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full ${score > 60 ? 'bg-green-500' : score > 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${score}%` }}
                />
              </div>
              <span className="text-xs w-6">{score.toFixed(0)}</span>
            </div>
          ))}
          
          {/* 人口推移ミニグラフ */}
          {inflowHistory.length > 1 && (
            <div className="mt-3 pt-2 border-t border-gray-700">
              <div className="text-xs text-gray-400 mb-1">年間流入推移</div>
              <ResponsiveContainer width="100%" height={80}>
                <AreaChart data={inflowHistory}>
                  <Area type="monotone" dataKey="industryInflow" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
                  <Area type="monotone" dataKey="masterInflow" stackId="1" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.6} />
                  <Area type="monotone" dataKey="govInflow" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.6} />
                  <Tooltip contentStyle={{ backgroundColor: '#333', border: 'none', fontSize: '10px' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* 時系列グラフ */}
      <div className="bg-gray-800 rounded p-3 mb-4">
        <h2 className="text-sm font-bold mb-2 text-yellow-300">📈 推移グラフ</h2>
        <ResponsiveContainer width="100%" height={180}>
          <ComposedChart data={history}>
            <CartesianGrid strokeDasharray="3 3" stroke="#444" />
            <XAxis dataKey="year" stroke="#888" tick={{ fontSize: 9 }} tickFormatter={(v) => POPULATION_STATS.baseYear + v} />
            <YAxis yAxisId="left" domain={[0, 100]} stroke="#888" tick={{ fontSize: 9 }} />
            <YAxis yAxisId="right" orientation="right" stroke="#888" tick={{ fontSize: 9 }} />
            <Tooltip contentStyle={{ backgroundColor: '#333', border: 'none', fontSize: '10px' }} 
                     labelFormatter={(v) => `${POPULATION_STATS.baseYear + v}年`} />
            <Legend wrapperStyle={{ fontSize: '10px' }} />
            <Line yAxisId="left" type="monotone" dataKey="normScore" stroke="#00ffff" strokeWidth={2} name="国力(偏差値)" dot={false} />
            <Line yAxisId="left" type="monotone" dataKey="succession" stroke="#f59e0b" strokeWidth={2} name="継承性" dot={false} />
            <Area yAxisId="right" type="monotone" dataKey="totalTalent" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.2} name="総人材" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* コントロール */}
      <div className="flex justify-center gap-3 mb-4">
        <button onClick={simulateYear} disabled={isSimulating}
          className="px-5 py-2 bg-blue-600 hover:bg-blue-700 rounded font-bold transition disabled:opacity-50">
          ▶️ 1年進める
        </button>
        <button onClick={() => setIsSimulating(!isSimulating)}
          className={`px-5 py-2 rounded font-bold transition ${isSimulating ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}>
          {isSimulating ? '⏸️ 停止' : '⏩ 自動実行'}
        </button>
        <button onClick={resetSimulation}
          className="px-5 py-2 bg-gray-600 hover:bg-gray-700 rounded font-bold transition">
          🔄 リセット
        </button>
      </div>

      {/* 人口統計モデル説明 */}
      <div className="bg-gray-800 rounded p-3">
        <h2 className="text-sm font-bold mb-2 text-cyan-300">📐 人口統計モデル</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-300">
          <div className="bg-gray-700 p-2 rounded">
            <div className="font-bold text-white">人口減少</div>
            <div className="font-mono mt-1">P(t) = P₀ × (1-r)^t</div>
            <div className="text-gray-400 mt-1">r = 1.2%/年</div>
          </div>
          <div className="bg-gray-700 p-2 rounded">
            <div className="font-bold text-white">進学フロー</div>
            <div className="font-mono mt-1">学部→修士: {(POPULATION_STATS.rates.masterEnrollment*100).toFixed(0)}%</div>
            <div className="text-gray-400 mt-1">修士→博士: {(POPULATION_STATS.rates.phdEnrollment*100).toFixed(0)}%</div>
          </div>
          <div className="bg-gray-700 p-2 rounded">
            <div className="font-bold text-white">博士進路</div>
            <div className="text-gray-400 mt-1">
              アカデミア: {(POPULATION_STATS.rates.phdToAcademia*100).toFixed(0)}%<br/>
              産業界: {(POPULATION_STATS.rates.phdToIndustry*100).toFixed(0)}%<br/>
              研究機関: {(POPULATION_STATS.rates.phdToResearch*100).toFixed(0)}%
            </div>
          </div>
          <div className="bg-gray-700 p-2 rounded">
            <div className="font-bold text-white">将来予測</div>
            <div className="text-gray-400 mt-1">
              2030: {(POPULATION_STATS.projections[2030]*100).toFixed(0)}%<br/>
              2040: {(POPULATION_STATS.projections[2040]*100).toFixed(0)}%<br/>
              2050: {(POPULATION_STATS.projections[2050]*100).toFixed(0)}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
