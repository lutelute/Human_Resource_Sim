/**
 * Human Resource Simulator v2 - Individual Tracking Model
 * 国家人材育成シミュレーター v2 - 個人追跡モデル
 *
 * Features:
 * - Individual skill tracking
 * - Mentoring system
 * - Succession risk prediction
 * - Virtual list for 500+ individuals
 * - Cross-sector transitions
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Legend,
  Tooltip,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar,
} from 'recharts';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  CAPABILITY_AXES,
  SECTORS,
  SIMULATION_CONSTANTS,
  type SkillVector,
  type InvestmentAllocation,
  type SectorKey,
} from '@hr-sim/core';

// Helper function to group array by key
function groupBy<T, K extends string>(array: T[], keyFn: (item: T) => K): Partial<Record<K, T[]>> {
  return array.reduce((acc, item) => {
    const key = keyFn(item);
    if (!acc[key]) acc[key] = [];
    acc[key]!.push(item);
    return acc;
  }, {} as Partial<Record<K, T[]>>);
}

// ============ Types ============
interface Individual {
  id: number;
  name: string;
  sector: SectorKey;
  role: string;
  age: number;
  tenure: number;
  maxTenure: number;
  skills: SkillVector;
  mentorId: number | null;
  menteeIds: number[];
}

interface HistoryEntry {
  year: number;
  capability: SkillVector;
  score: number;
  headcount: number;
  successionScore: number;
}

interface EventLog {
  year: number;
  message: string;
  type: 'join' | 'leave' | 'promotion' | 'mentoring' | 'transition';
}

// Economy system: budget, income, expenditure
interface EconomyState {
  budget: number;        // Current available budget (trillion yen)
  totalIncome: number;   // Accumulated income
  totalExpense: number;  // Accumulated expense
}

interface EconomyHistoryEntry {
  year: number;
  budget: number;
  income: number;
  expense: number;
}

// Cost per person by sector (billion yen per year)
const SECTOR_COSTS: Record<SectorKey, number> = {
  university: 0.15,   // 1500万円/人/年
  industry: 0.05,     // 500万円/人/年 (民間企業への補助金)
  government: 0.12,   // 1200万円/人/年
  research: 0.20,     // 2000万円/人/年
};

// Income generation multipliers by capability
const INCOME_MULTIPLIERS: Partial<Record<string, number>> = {
  appliedTech: 0.8,      // Applied technology drives income
  manufacturing: 0.6,    // Manufacturing output
  digitalAI: 1.0,        // High-value digital products
  finance: 0.5,          // Financial services
  implementation: 0.4,   // Execution capability
  globalCompete: 0.7,    // Export competitiveness
};

// ============ Constants ============
const ROLE_TENURE: Record<string, { name: string; min: number; max: number; avg: number }> = {
  professor: { name: '教授', min: 30, max: 40, avg: 35 },
  assist_prof: { name: '助教', min: 5, max: 10, avg: 7 },
  phd_student: { name: '博士課程', min: 3, max: 5, avg: 4 },
  master_student: { name: '修士課程', min: 1, max: 2, avg: 2 },
  senior_engineer: { name: 'シニアエンジニア', min: 5, max: 10, avg: 7 },
  mid_engineer: { name: '中堅エンジニア', min: 3, max: 5, avg: 4 },
  junior_engineer: { name: '若手エンジニア', min: 2, max: 4, avg: 3 },
  senior_official: { name: '上級官僚', min: 3, max: 5, avg: 4 },
  official: { name: '官僚', min: 2, max: 3, avg: 3 },
  researcher: { name: '研究員', min: 5, max: 10, avg: 7 },
};

const TARGET_CAPABILITY: SkillVector = {
  basicScience: 85,
  appliedTech: 85,
  digitalAI: 90,
  manufacturing: 80,
  finance: 75,
  energy: 80,
  globalCompete: 75,
  innovation: 85,
  education: 80,
  policyMaking: 70,
  implementation: 80,
  succession: 85,
};

// Create initial individuals (~100 people)
function createInitialIndividuals(): Individual[] {
  const individuals: Individual[] = [];
  let id = 1;

  // University sector (30 people: 5 professors, 8 assist_profs, 17 students)
  for (let i = 0; i < 5; i++) {
    individuals.push({
      id: id++,
      name: `教授${i + 1}`,
      sector: 'university',
      role: 'professor',
      age: 50 + Math.floor(Math.random() * 15),
      tenure: 20 + Math.floor(Math.random() * 10),
      maxTenure: ROLE_TENURE.professor.avg,
      skills: generateSkills('university', 'senior'),
      mentorId: null,
      menteeIds: [],
    });
  }
  for (let i = 0; i < 8; i++) {
    individuals.push({
      id: id++,
      name: `助教${i + 1}`,
      sector: 'university',
      role: 'assist_prof',
      age: 30 + Math.floor(Math.random() * 10),
      tenure: 2 + Math.floor(Math.random() * 5),
      maxTenure: ROLE_TENURE.assist_prof.avg,
      skills: generateSkills('university', 'mid'),
      mentorId: null,
      menteeIds: [],
    });
  }
  for (let i = 0; i < 17; i++) {
    individuals.push({
      id: id++,
      name: `院生${i + 1}`,
      sector: 'university',
      role: Math.random() > 0.5 ? 'phd_student' : 'master_student',
      age: 22 + Math.floor(Math.random() * 6),
      tenure: Math.floor(Math.random() * 3),
      maxTenure: Math.random() > 0.5 ? ROLE_TENURE.phd_student.avg : ROLE_TENURE.master_student.avg,
      skills: generateSkills('university', 'junior'),
      mentorId: null,
      menteeIds: [],
    });
  }

  // Industry sector (40 people: 8 seniors, 18 mid, 14 juniors)
  for (let i = 0; i < 8; i++) {
    individuals.push({
      id: id++,
      name: `シニアEng${i + 1}`,
      sector: 'industry',
      role: 'senior_engineer',
      age: 40 + Math.floor(Math.random() * 15),
      tenure: 5 + Math.floor(Math.random() * 5),
      maxTenure: ROLE_TENURE.senior_engineer.avg,
      skills: generateSkills('industry', 'senior'),
      mentorId: null,
      menteeIds: [],
    });
  }
  for (let i = 0; i < 18; i++) {
    individuals.push({
      id: id++,
      name: `中堅Eng${i + 1}`,
      sector: 'industry',
      role: 'mid_engineer',
      age: 30 + Math.floor(Math.random() * 10),
      tenure: 2 + Math.floor(Math.random() * 3),
      maxTenure: ROLE_TENURE.mid_engineer.avg,
      skills: generateSkills('industry', 'mid'),
      mentorId: null,
      menteeIds: [],
    });
  }
  for (let i = 0; i < 14; i++) {
    individuals.push({
      id: id++,
      name: `若手Eng${i + 1}`,
      sector: 'industry',
      role: 'junior_engineer',
      age: 22 + Math.floor(Math.random() * 5),
      tenure: Math.floor(Math.random() * 2),
      maxTenure: ROLE_TENURE.junior_engineer.avg,
      skills: generateSkills('industry', 'junior'),
      mentorId: null,
      menteeIds: [],
    });
  }

  // Government sector (15 people: 4 senior_officials, 11 officials)
  for (let i = 0; i < 4; i++) {
    individuals.push({
      id: id++,
      name: `局長${i + 1}`,
      sector: 'government',
      role: 'senior_official',
      age: 50 + Math.floor(Math.random() * 10),
      tenure: 2 + Math.floor(Math.random() * 2),
      maxTenure: ROLE_TENURE.senior_official.avg,
      skills: generateSkills('government', 'senior'),
      mentorId: null,
      menteeIds: [],
    });
  }
  for (let i = 0; i < 11; i++) {
    individuals.push({
      id: id++,
      name: `官僚${i + 1}`,
      sector: 'government',
      role: 'official',
      age: 30 + Math.floor(Math.random() * 15),
      tenure: Math.floor(Math.random() * 3),
      maxTenure: ROLE_TENURE.official.avg,
      skills: generateSkills('government', 'mid'),
      mentorId: null,
      menteeIds: [],
    });
  }

  // Research sector (15 people: 5 senior researchers, 10 researchers)
  for (let i = 0; i < 5; i++) {
    individuals.push({
      id: id++,
      name: `主任研究員${i + 1}`,
      sector: 'research',
      role: 'researcher',
      age: 45 + Math.floor(Math.random() * 10),
      tenure: 5 + Math.floor(Math.random() * 5),
      maxTenure: ROLE_TENURE.researcher.avg + 3,
      skills: generateSkills('research', 'senior'),
      mentorId: null,
      menteeIds: [],
    });
  }
  for (let i = 0; i < 10; i++) {
    individuals.push({
      id: id++,
      name: `研究員${i + 1}`,
      sector: 'research',
      role: 'researcher',
      age: 30 + Math.floor(Math.random() * 15),
      tenure: Math.floor(Math.random() * 5),
      maxTenure: ROLE_TENURE.researcher.avg,
      skills: generateSkills('research', 'mid'),
      mentorId: null,
      menteeIds: [],
    });
  }

  return individuals;
}

function generateSkills(sector: SectorKey, level: 'senior' | 'mid' | 'junior'): SkillVector {
  const base = level === 'senior' ? 60 : level === 'mid' ? 40 : 25;
  const variance = level === 'senior' ? 30 : level === 'mid' ? 25 : 20;

  const skills: SkillVector = {} as SkillVector;
  for (const axis of CAPABILITY_AXES) {
    let bonus = 0;
    if (sector === 'university' && ['basicScience', 'education', 'innovation'].includes(axis.key)) {
      bonus = 15;
    } else if (sector === 'industry' && ['appliedTech', 'manufacturing', 'digitalAI', 'implementation'].includes(axis.key)) {
      bonus = 15;
    } else if (sector === 'government' && ['policyMaking', 'finance'].includes(axis.key)) {
      bonus = 15;
    } else if (sector === 'research' && ['basicScience', 'appliedTech', 'innovation'].includes(axis.key)) {
      bonus = 15;
    }
    skills[axis.key] = Math.min(100, Math.max(0, base + bonus + Math.random() * variance));
  }
  return skills;
}

// ============ Main App ============
function App() {
  const [year, setYear] = useState(0);
  const [individuals, setIndividuals] = useState<Individual[]>(createInitialIndividuals);
  const [investments, setInvestments] = useState<InvestmentAllocation>({
    university: 30,
    industry: 35,
    government: 15,
    research: 20,
  });
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [events, setEvents] = useState<EventLog[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);

  // Economy state (starting budget: 10 trillion yen)
  const [economy, setEconomy] = useState<EconomyState>({
    budget: 10,
    totalIncome: 0,
    totalExpense: 0,
  });
  const [economyHistory, setEconomyHistory] = useState<EconomyHistoryEntry[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<Individual | null>(null);
  const listParentRef = useRef<HTMLDivElement>(null);

  // Virtual list for 500+ individuals
  const rowVirtualizer = useVirtualizer({
    count: individuals.length,
    getScrollElement: () => listParentRef.current,
    estimateSize: () => 60,
  });

  // Calculate national capability using CES aggregation
  const capability = useMemo((): SkillVector => {
    const cap: SkillVector = {} as SkillVector;
    for (const axis of CAPABILITY_AXES) {
      const values = individuals.map(ind => ind.skills[axis.key] || 0);
      const sum = values.reduce((a, b) => a + Math.pow(b, SIMULATION_CONSTANTS.CES_EXPONENT), 0);
      const ces = Math.pow(sum, 1 / SIMULATION_CONSTANTS.CES_EXPONENT) / individuals.length;
      const min = Math.min(...values);
      cap[axis.key] = ces * 0.7 + min * 0.3;
    }
    return cap;
  }, [individuals]);

  // Calculate succession score
  const successionScore = useMemo((): number => {
    let score = 0;
    const sectorGroups = groupBy(individuals, ind => ind.sector);

    for (const sector of SECTORS) {
      const sectorPeople = sectorGroups[sector.key] || [];
      if (sectorPeople.length === 0) continue;

      // Age diversity score
      const ages = sectorPeople.map(p => p.age);
      const ageRange = Math.max(...ages) - Math.min(...ages);
      const ageScore = (Math.min(40, ageRange) / 40) * 30;

      // Tenure margin score
      const tenureMargin = sectorPeople.reduce((sum, p) => {
        return sum + Math.max(0, p.maxTenure - p.tenure) / p.maxTenure;
      }, 0) / sectorPeople.length;
      const tenureScore = tenureMargin * 40;

      // Mentoring density score
      const mentoredCount = sectorPeople.filter(p => p.mentorId !== null).length;
      const mentorScore = (mentoredCount / sectorPeople.length) * 30;

      score += (ageScore + tenureScore + mentorScore) / 3;
    }

    return score / SECTORS.length;
  }, [individuals]);

  // Calculate total score
  const totalScore = useMemo((): number => {
    const values = Object.values(capability);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const min = Math.min(...values);
    return SIMULATION_CONSTANTS.SCORE_AVG_WEIGHT * avg + SIMULATION_CONSTANTS.SCORE_MIN_WEIGHT * min;
  }, [capability]);

  // Calculate annual income from industry productivity
  const annualIncome = useMemo((): number => {
    // Industry sector generates income based on:
    // - Number of industry workers
    // - Their capability levels in income-generating axes
    const industryPeople = individuals.filter(p => p.sector === 'industry');
    if (industryPeople.length === 0) return 0;

    let productivityScore = 0;
    for (const person of industryPeople) {
      // Weight by role (senior generates more value)
      const roleMultiplier = person.role === 'senior_engineer' ? 1.5
        : person.role === 'mid_engineer' ? 1.0 : 0.6;

      // Sum income-generating capabilities
      let personIncome = 0;
      for (const [axis, multiplier] of Object.entries(INCOME_MULTIPLIERS)) {
        if (multiplier !== undefined) {
          personIncome += (person.skills[axis as keyof SkillVector] || 0) * multiplier;
        }
      }
      productivityScore += personIncome * roleMultiplier / 100;
    }

    // Base income: 0.5 trillion yen per productivity point
    return productivityScore * 0.5;
  }, [individuals]);

  // Calculate annual expenditure based on investment allocation
  const annualExpense = useMemo((): number => {
    const sectorGroups = groupBy(individuals, ind => ind.sector);
    let expense = 0;

    for (const sector of SECTORS) {
      const sectorPeople = sectorGroups[sector.key] || [];
      const investmentRate = investments[sector.key] / 100;
      // Cost = base cost per person × investment rate × number of people
      expense += SECTOR_COSTS[sector.key] * investmentRate * sectorPeople.length;
    }

    return expense;
  }, [individuals, investments]);

  // Simulate one year
  const simulateYear = useCallback(() => {
    const newEvents: EventLog[] = [];

    setIndividuals(prev => {
      let updated = prev.map(person => {
        const newPerson = { ...person, skills: { ...person.skills } };
        newPerson.age += 1;
        newPerson.tenure += 1;

        // Skill growth based on sector and investment
        const sectorInvestment = investments[person.sector] / 100;
        const growthMultiplier = sectorInvestment * 3;

        for (const axis of CAPABILITY_AXES) {
          let growth = 0.5; // Base growth

          // Sector-specific boosts
          if (person.sector === 'university' && ['basicScience', 'education', 'innovation'].includes(axis.key)) {
            growth += growthMultiplier * (person.role === 'professor' ? 1.5 : 1);
          } else if (person.sector === 'industry' && ['appliedTech', 'manufacturing', 'digitalAI', 'implementation'].includes(axis.key)) {
            growth += growthMultiplier * 1.2;
          } else if (person.sector === 'government' && ['policyMaking', 'finance'].includes(axis.key)) {
            growth += growthMultiplier;
          } else if (person.sector === 'research' && ['basicScience', 'appliedTech', 'innovation', 'globalCompete'].includes(axis.key)) {
            growth += growthMultiplier * 1.3;
          }

          // Mentoring bonus
          if (person.mentorId !== null) {
            const mentor = prev.find(p => p.id === person.mentorId);
            if (mentor && mentor.skills[axis.key] > person.skills[axis.key]) {
              growth += (mentor.skills[axis.key] - person.skills[axis.key]) * 0.05;
            }
          }

          // Age efficiency (peaks around 35, declines after 50)
          const ageEfficiency = person.age < 35
            ? 0.8 + (person.age - 22) * 0.02
            : Math.max(0.5, 1.2 - (person.age - 35) * 0.02);
          growth *= ageEfficiency;

          // Apply decay
          const decay = axis.key === 'digitalAI'
            ? SIMULATION_CONSTANTS.DIGITAL_AI_DECAY
            : SIMULATION_CONSTANTS.STANDARD_DECAY;

          newPerson.skills[axis.key] = Math.min(100, Math.max(0,
            person.skills[axis.key] + growth - decay + (Math.random() - 0.5) * 2
          ));
        }

        return newPerson;
      });

      // Process departures
      const departures: Individual[] = [];
      updated = updated.filter(person => {
        const shouldLeave = person.tenure >= person.maxTenure ||
          (person.age >= 65 && person.role.includes('professor')) ||
          (person.age >= 60 && person.sector === 'government');

        if (shouldLeave) {
          departures.push(person);
          const reason = person.tenure >= person.maxTenure
            ? (person.role.includes('student') ? '卒業' : '任期満了')
            : '定年退職';
          newEvents.push({
            year: year + 1,
            message: `${person.name} が${reason}しました`,
            type: 'leave',
          });
          return false;
        }
        return true;
      });

      // Remove mentor references for departed people
      const departedIds = new Set(departures.map(p => p.id));
      updated = updated.map(person => {
        if (person.mentorId && departedIds.has(person.mentorId)) {
          return { ...person, mentorId: null };
        }
        return person;
      });

      // Add new individuals (based on investment)
      const newHireChance = (investments.university + investments.industry) / 200;
      if (Math.random() < newHireChance) {
        const sectors: SectorKey[] = ['university', 'industry', 'government', 'research'];
        const sector = sectors[Math.floor(Math.random() * sectors.length)];
        const roles: Record<SectorKey, string[]> = {
          university: ['master_student', 'phd_student', 'assist_prof'],
          industry: ['junior_engineer', 'mid_engineer'],
          government: ['official'],
          research: ['researcher'],
        };
        const role = roles[sector][Math.floor(Math.random() * roles[sector].length)];
        const newId = Math.max(...updated.map(p => p.id), 0) + 1;

        const newPerson: Individual = {
          id: newId,
          name: `新人${newId}`,
          sector,
          role,
          age: role.includes('student') ? 22 + Math.floor(Math.random() * 4) : 25 + Math.floor(Math.random() * 10),
          tenure: 0,
          maxTenure: ROLE_TENURE[role]?.avg || 5,
          skills: generateSkills(sector, 'junior'),
          mentorId: null,
          menteeIds: [],
        };
        updated.push(newPerson);
        newEvents.push({
          year: year + 1,
          message: `${newPerson.name} が${SECTORS.find(s => s.key === sector)?.name || sector}に加入`,
          type: 'join',
        });
      }

      // Auto-assign mentors
      const unmmentored = updated.filter(p => p.mentorId === null && p.role.includes('student') || p.role === 'junior_engineer');
      for (const mentee of unmmentored.slice(0, 3)) {
        const potentialMentors = updated.filter(p =>
          p.sector === mentee.sector &&
          p.id !== mentee.id &&
          !p.role.includes('student') &&
          p.role !== 'junior_engineer' &&
          p.menteeIds.length < 3
        );
        if (potentialMentors.length > 0) {
          const mentor = potentialMentors[Math.floor(Math.random() * potentialMentors.length)];
          mentee.mentorId = mentor.id;
          mentor.menteeIds.push(mentee.id);
          if (newEvents.length < 5) {
            newEvents.push({
              year: year + 1,
              message: `${mentor.name} が ${mentee.name} のメンターになりました`,
              type: 'mentoring',
            });
          }
        }
      }

      // Cross-sector transitions (rare)
      if (Math.random() < 0.1) {
        const eligible = updated.filter(p =>
          (p.role === 'phd_student' && p.tenure >= 3) ||
          (p.role === 'assist_prof' && p.tenure >= 5) ||
          (p.role === 'mid_engineer' && p.tenure >= 3)
        );
        if (eligible.length > 0) {
          const person = eligible[Math.floor(Math.random() * eligible.length)];
          const currentSector = person.sector;
          let newSector: SectorKey;
          let newRole: string;

          if (currentSector === 'university') {
            newSector = Math.random() > 0.5 ? 'industry' : 'research';
            newRole = newSector === 'industry' ? 'mid_engineer' : 'researcher';
          } else if (currentSector === 'industry') {
            newSector = 'research';
            newRole = 'researcher';
          } else {
            return updated;
          }

          const idx = updated.findIndex(p => p.id === person.id);
          if (idx !== -1) {
            updated[idx] = {
              ...person,
              sector: newSector,
              role: newRole,
              tenure: 0,
              maxTenure: ROLE_TENURE[newRole]?.avg || 5,
              mentorId: null,
              menteeIds: [],
            };
            newEvents.push({
              year: year + 1,
              message: `${person.name} が${SECTORS.find(s => s.key === currentSector)?.name}から${SECTORS.find(s => s.key === newSector)?.name}へ転職`,
              type: 'transition',
            });
          }
        }
      }

      return updated;
    });

    setEvents(prev => [...newEvents, ...prev].slice(0, 20));
    setYear(y => y + 1);

    // Update economy: income - expense = net change to budget
    setEconomy(prev => {
      const netChange = annualIncome - annualExpense;
      return {
        budget: prev.budget + netChange,
        totalIncome: prev.totalIncome + annualIncome,
        totalExpense: prev.totalExpense + annualExpense,
      };
    });
  }, [investments, year, annualIncome, annualExpense]);

  // Record history
  useEffect(() => {
    setHistory(prev => [...prev, {
      year,
      capability: { ...capability },
      score: totalScore,
      headcount: individuals.length,
      successionScore,
    }]);
    // Record economy history
    setEconomyHistory(prev => [...prev, {
      year,
      budget: economy.budget,
      income: annualIncome,
      expense: annualExpense,
    }]);
  }, [year, capability, totalScore, individuals.length, successionScore, economy.budget, annualIncome, annualExpense]);

  // Auto simulation
  useEffect(() => {
    if (!isSimulating) return;
    const interval = setInterval(simulateYear, 600);
    return () => clearInterval(interval);
  }, [isSimulating, simulateYear]);

  // Reset
  const reset = useCallback(() => {
    setIsSimulating(false);
    setYear(0);
    setIndividuals(createInitialIndividuals());
    setHistory([]);
    setEvents([]);
    setSelectedPerson(null);
    setEconomy({
      budget: 10,
      totalIncome: 0,
      totalExpense: 0,
    });
    setEconomyHistory([]);
  }, []);

  // Export
  const handleExport = useCallback(() => {
    const data = {
      version: '2.1.0',
      timestamp: new Date().toISOString(),
      year,
      individuals,
      capability,
      history,
      events,
      economy,
      economyHistory,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hr-sim-v2-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [year, individuals, capability, history, events, economy, economyHistory]);

  // Predict retirement in next N years
  const retirementRisk = useMemo(() => {
    const atRisk: { person: Individual; yearsLeft: number }[] = [];
    for (const person of individuals) {
      const yearsLeft = Math.max(0, person.maxTenure - person.tenure);
      const retireAge = person.sector === 'government' ? 60 : 65;
      const yearsToRetireAge = Math.max(0, retireAge - person.age);
      const effectiveYearsLeft = Math.min(yearsLeft, yearsToRetireAge);

      if (effectiveYearsLeft <= 5 && !person.role.includes('student')) {
        atRisk.push({ person, yearsLeft: effectiveYearsLeft });
      }
    }
    return atRisk.sort((a, b) => a.yearsLeft - b.yearsLeft);
  }, [individuals]);

  // Prepare radar data
  const radarData = CAPABILITY_AXES.map(axis => ({
    axis: axis.name,
    current: capability[axis.key],
    target: TARGET_CAPABILITY[axis.key],
  }));

  // Prepare history chart data
  const historyData = history.map(h => ({
    year: 2024 + h.year,
    score: h.score,
    headcount: h.headcount,
    succession: h.successionScore,
  }));

  // Sector distribution
  const sectorCounts = groupBy(individuals, ind => ind.sector);
  const sectorData = SECTORS.map(sector => ({
    name: sector.name,
    count: sectorCounts[sector.key]?.length || 0,
    color: sector.color,
  }));

  const totalInvestment = Object.values(investments).reduce((a, b) => a + b, 0);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header */}
        <header className="text-center py-4">
          <h1 className="text-3xl font-bold text-cyan-400">
            国家人材育成シミュレーター v2
          </h1>
          <p className="text-gray-400 text-sm">Individual Tracking × Mentoring × Succession Model</p>
        </header>

        {/* Status Bar */}
        <div className="bg-gray-800 rounded-lg p-4 grid grid-cols-5 gap-4">
          <div className="text-center">
            <div className="text-xs text-gray-400">Year</div>
            <div className="text-2xl font-bold text-yellow-400">{2024 + year}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-400">人材数</div>
            <div className="text-2xl font-bold text-green-400">{individuals.length}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-400">総合スコア</div>
            <div className="text-2xl font-bold text-cyan-400">{totalScore.toFixed(1)}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-400">継承性</div>
            <div className="text-2xl font-bold text-purple-400">{successionScore.toFixed(1)}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-400">退職リスク</div>
            <div className={`text-2xl font-bold ${retirementRisk.length > 5 ? 'text-red-400' : 'text-orange-400'}`}>
              {retirementRisk.length}名
            </div>
          </div>
        </div>

        {/* Economy Status Bar */}
        <div className="bg-gray-800 rounded-lg p-4 grid grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-xs text-gray-400">国家予算</div>
            <div className={`text-2xl font-bold ${economy.budget >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {economy.budget.toFixed(1)}兆円
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-400">年間収入 (産業)</div>
            <div className="text-2xl font-bold text-blue-400">+{annualIncome.toFixed(2)}兆円</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-400">年間支出 (投資)</div>
            <div className="text-2xl font-bold text-orange-400">-{annualExpense.toFixed(2)}兆円</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-400">年間収支</div>
            <div className={`text-2xl font-bold ${annualIncome - annualExpense >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {(annualIncome - annualExpense) >= 0 ? '+' : ''}{(annualIncome - annualExpense).toFixed(2)}兆円
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex justify-center gap-2">
          <button
            onClick={simulateYear}
            disabled={isSimulating}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded"
          >
            1年進める
          </button>
          <button
            onClick={() => setIsSimulating(!isSimulating)}
            className={`px-4 py-2 rounded ${isSimulating ? 'bg-red-600' : 'bg-green-600'}`}
          >
            {isSimulating ? '停止' : '自動実行'}
          </button>
          <button onClick={reset} className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded">
            リセット
          </button>
          <button onClick={handleExport} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded">
            Export
          </button>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* National Radar */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-lg font-bold mb-2 text-cyan-300">国力レーダー</h3>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#444" />
                <PolarAngleAxis dataKey="axis" tick={{ fill: '#9ca3af', fontSize: 9 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} />
                <Radar name="現在" dataKey="current" stroke="#22d3ee" fill="#22d3ee" fillOpacity={0.3} />
                <Radar name="目標" dataKey="target" stroke="#fbbf24" fill="transparent" strokeDasharray="3 3" />
                <Legend />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Sector Distribution */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-lg font-bold mb-2 text-green-300">セクター分布</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={sectorData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Investment Sliders */}
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">投資配分</h3>
              <span className={`text-sm ${Math.abs(totalInvestment - 100) < 1 ? 'text-green-400' : 'text-red-400'}`}>
                合計: {totalInvestment}%
              </span>
            </div>

            {SECTORS.map(sector => (
              <div key={sector.key} className="mb-4">
                <div className="flex justify-between text-sm mb-1">
                  <span>{sector.icon} {sector.name}</span>
                  <span>{investments[sector.key]}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={investments[sector.key]}
                  onChange={e => setInvestments(prev => ({ ...prev, [sector.key]: Number(e.target.value) }))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Individual List and Person Profile */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Virtual List */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-lg font-bold mb-3 text-green-300">人材一覧 ({individuals.length}名)</h3>
            <div
              ref={listParentRef}
              className="h-72 overflow-auto"
            >
              <div
                style={{
                  height: `${rowVirtualizer.getTotalSize()}px`,
                  width: '100%',
                  position: 'relative',
                }}
              >
                {rowVirtualizer.getVirtualItems().map(virtualRow => {
                  const person = individuals[virtualRow.index];
                  const isSelected = selectedPerson?.id === person.id;
                  const nearRetire = person.tenure >= person.maxTenure - 2 && !person.role.includes('student');

                  return (
                    <div
                      key={person.id}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      <div
                        onClick={() => setSelectedPerson(person)}
                        className={`flex items-center justify-between p-2 rounded cursor-pointer mx-1 ${
                          isSelected ? 'bg-cyan-900 ring-2 ring-cyan-400' : 'bg-gray-700 hover:bg-gray-600'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg">
                            {person.sector === 'university' ? '🎓' :
                              person.sector === 'industry' ? '🏭' :
                                person.sector === 'government' ? '🏛️' : '🔬'}
                          </span>
                          <div>
                            <div className="font-medium text-sm">{person.name}</div>
                            <div className="text-xs text-gray-400">{ROLE_TENURE[person.role]?.name || person.role}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm">{person.age}歳</div>
                          <div className="text-xs text-gray-400">
                            {person.tenure}/{person.maxTenure}年
                            {nearRetire && <span className="text-red-400 ml-1">⚠</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Person Profile */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-lg font-bold mb-3 text-pink-300">個人プロファイル</h3>
            {selectedPerson ? (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-3xl">
                    {selectedPerson.sector === 'university' ? '🎓' :
                      selectedPerson.sector === 'industry' ? '🏭' :
                        selectedPerson.sector === 'government' ? '🏛️' : '🔬'}
                  </span>
                  <div>
                    <div className="font-bold text-lg">{selectedPerson.name}</div>
                    <div className="text-sm text-gray-400">
                      {ROLE_TENURE[selectedPerson.role]?.name} | {selectedPerson.age}歳 | 在籍{selectedPerson.tenure}年
                    </div>
                    {selectedPerson.mentorId && (
                      <div className="text-xs text-cyan-400">
                        メンター: {individuals.find(p => p.id === selectedPerson.mentorId)?.name}
                      </div>
                    )}
                    {selectedPerson.menteeIds.length > 0 && (
                      <div className="text-xs text-purple-400">
                        メンティー: {selectedPerson.menteeIds.map(id =>
                        individuals.find(p => p.id === id)?.name).join(', ')}
                      </div>
                    )}
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <RadarChart data={CAPABILITY_AXES.map(axis => ({
                    axis: axis.name,
                    value: selectedPerson.skills[axis.key],
                    target: TARGET_CAPABILITY[axis.key] * 0.8,
                  }))}>
                    <PolarGrid stroke="#444" />
                    <PolarAngleAxis dataKey="axis" tick={{ fill: '#9ca3af', fontSize: 8 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} />
                    <Radar name="能力" dataKey="value" stroke="#f472b6" fill="#f472b6" fillOpacity={0.3} />
                    <Radar name="基準" dataKey="target" stroke="#888" fill="transparent" strokeDasharray="3 3" />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </>
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-500">
                人材リストから選択してください
              </div>
            )}
          </div>
        </div>

        {/* Retirement Risk & Events */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Retirement Risk */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-lg font-bold mb-3 text-orange-300">5年以内退職予測</h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {retirementRisk.length === 0 ? (
                <div className="text-green-400 text-sm">緊急の退職リスクなし</div>
              ) : (
                retirementRisk.slice(0, 10).map(({ person, yearsLeft }) => (
                  <div key={person.id} className="flex justify-between bg-gray-700 p-2 rounded text-sm">
                    <span>{person.name} ({ROLE_TENURE[person.role]?.name})</span>
                    <span className={yearsLeft <= 2 ? 'text-red-400' : 'text-yellow-400'}>
                      残り{yearsLeft}年
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Event Log */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-lg font-bold mb-3 text-purple-300">イベントログ</h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {events.length === 0 ? (
                <div className="text-gray-500 text-sm">シミュレーション開始でイベント表示</div>
              ) : (
                events.slice(0, 10).map((event, i) => (
                  <div key={i} className="text-sm bg-gray-700 rounded p-2">
                    <span className="text-gray-400">[{2024 + event.year}] </span>
                    {event.message}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* History Chart */}
        {history.length > 1 && (
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-lg font-bold mb-2">推移グラフ</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={historyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="score" name="総合スコア" stroke="#22d3ee" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="succession" name="継承性" stroke="#a855f7" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Economy Chart */}
        {economyHistory.length > 1 && (
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-lg font-bold mb-2 text-emerald-300">財政推移</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={economyHistory.map(e => ({
                year: 2024 + e.year,
                budget: e.budget,
                income: e.income,
                expense: e.expense,
                netFlow: e.income - e.expense,
              }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <Tooltip formatter={(value: number) => `${value.toFixed(2)}兆円`} />
                <Legend />
                <Line type="monotone" dataKey="budget" name="予算残高" stroke="#10b981" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="income" name="収入" stroke="#3b82f6" strokeWidth={1} dot={false} />
                <Line type="monotone" dataKey="expense" name="支出" stroke="#f97316" strokeWidth={1} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Footer */}
        <footer className="text-center text-xs text-gray-500 py-4 border-t border-gray-800">
          v2.1 Individual Tracking Model - メンタリング・継承予測・セクター間移動・財政フロー対応
        </footer>
      </div>
    </div>
  );
}

export default App;
