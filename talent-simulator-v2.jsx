import React, { useState, useEffect, useCallback } from 'react';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar } from 'recharts';

// 能力軸の定義（11軸 - 医療除外）
const CAPABILITY_AXES = [
  { key: 'basicScience', name: '基礎科学', color: '#8884d8' },
  { key: 'appliedTech', name: '応用技術', color: '#82ca9d' },
  { key: 'digitalAI', name: 'デジタル・AI', color: '#ffc658' },
  { key: 'manufacturing', name: '製造・ものづくり', color: '#ff7300' },
  { key: 'finance', name: '金融・経済', color: '#00C49F' },
  // { key: 'healthcare', name: '医療・ヘルスケア', color: '#FFBB28' }, // コメントアウト
  { key: 'energy', name: 'エネルギー・環境', color: '#FF8042' },
  { key: 'globalCompete', name: '国際競争力', color: '#0088FE' },
  { key: 'innovation', name: 'イノベーション', color: '#00C49F' },
  { key: 'education', name: '教育基盤', color: '#FFBB28' },
  { key: 'policyMaking', name: '政策立案', color: '#FF8042' },
  { key: 'implementation', name: '社会実装力', color: '#8884d8' },
  { key: 'succession', name: '技術継承性', color: '#9333ea' }, // 新規追加
];

// セクター別在籍期間（年）
const SECTOR_TENURE = {
  university_professor: { name: '大学教授', min: 30, max: 40, avg: 35 },
  university_student_bachelor: { name: '学部生', min: 3, max: 4, avg: 4 },
  university_student_master: { name: '修士', min: 1, max: 2, avg: 2 },
  university_student_doctor: { name: '博士', min: 3, max: 5, avg: 3 },
  industry_engineer: { name: '産業界エンジニア', min: 3, max: 5, avg: 4 },
  government_official: { name: '政界・官僚', min: 2, max: 3, avg: 3 },
  researcher: { name: '外部研究者', min: 5, max: 10, avg: 7 },
};

// 個人プロファイル定義
const createIndividual = (id, name, sector, role, age, tenure, skills) => ({
  id,
  name,
  sector,
  role,
  age,
  tenure, // 現在の在籍年数
  maxTenure: SECTOR_TENURE[role]?.avg || 5,
  skills: { ...skills },
  mentoring: 0, // メンタリング能力
  successorCount: 0, // 育成した後継者数
});

// 初期個人データ
const initialIndividuals = [
  // 大学セクター
  createIndividual(1, '山田教授', 'university', 'university_professor', 55, 25, {
    basicScience: 90, appliedTech: 60, digitalAI: 40, manufacturing: 30,
    finance: 20, energy: 50, globalCompete: 70, innovation: 65,
    education: 85, policyMaking: 40, implementation: 35, succession: 80,
  }),
  createIndividual(2, '鈴木助教', 'university', 'university_professor', 35, 5, {
    basicScience: 70, appliedTech: 55, digitalAI: 65, manufacturing: 25,
    finance: 15, energy: 40, globalCompete: 50, innovation: 60,
    education: 50, policyMaking: 20, implementation: 30, succession: 40,
  }),
  createIndividual(3, '田中（修士）', 'university', 'university_student_master', 24, 1, {
    basicScience: 45, appliedTech: 35, digitalAI: 50, manufacturing: 20,
    finance: 10, energy: 25, globalCompete: 30, innovation: 40,
    education: 15, policyMaking: 5, implementation: 15, succession: 10,
  }),
  
  // 産業界セクター
  createIndividual(4, '佐藤（若手SE）', 'industry', 'industry_engineer', 26, 2, {
    basicScience: 30, appliedTech: 55, digitalAI: 70, manufacturing: 40,
    finance: 25, energy: 20, globalCompete: 35, innovation: 45,
    education: 10, policyMaking: 5, implementation: 60, succession: 15,
  }),
  createIndividual(5, '高橋（シニアEng）', 'industry', 'industry_engineer', 45, 4, {
    basicScience: 40, appliedTech: 85, digitalAI: 60, manufacturing: 80,
    finance: 35, energy: 45, globalCompete: 50, innovation: 55,
    education: 30, policyMaking: 25, implementation: 85, succession: 70,
  }),
  createIndividual(6, '伊藤（中堅）', 'industry', 'industry_engineer', 35, 3, {
    basicScience: 35, appliedTech: 70, digitalAI: 75, manufacturing: 55,
    finance: 30, energy: 30, globalCompete: 40, innovation: 50,
    education: 20, policyMaking: 15, implementation: 70, succession: 35,
  }),
  
  // 政府セクター
  createIndividual(7, '渡辺（官僚）', 'government', 'government_official', 40, 2, {
    basicScience: 25, appliedTech: 30, digitalAI: 35, manufacturing: 20,
    finance: 70, energy: 55, globalCompete: 45, innovation: 30,
    education: 25, policyMaking: 80, implementation: 60, succession: 25,
  }),
];

// 初期国力状態
const calculateNationalCapability = (individuals) => {
  const capability = {};
  CAPABILITY_AXES.forEach(axis => {
    const values = individuals.map(ind => ind.skills[axis.key] || 0);
    // CES型集約 + 最小値ペナルティ
    const sum = values.reduce((a, b) => a + Math.pow(b, 0.8), 0);
    const ces = Math.pow(sum, 1/0.8) / individuals.length;
    const min = Math.min(...values);
    capability[axis.key] = ces * 0.7 + min * 0.3;
  });
  return capability;
};

// 技術継承性スコア計算
const calculateSuccessionScore = (individuals) => {
  let score = 0;
  const sectors = ['university', 'industry', 'government'];
  
  sectors.forEach(sector => {
    const sectorPeople = individuals.filter(i => i.sector === sector);
    if (sectorPeople.length === 0) return;
    
    // 年齢分布の多様性
    const ages = sectorPeople.map(p => p.age);
    const ageRange = Math.max(...ages) - Math.min(...ages);
    const ageScore = Math.min(40, ageRange) / 40 * 30;
    
    // 在籍年数の余裕度
    const tenureMargin = sectorPeople.reduce((sum, p) => {
      return sum + Math.max(0, p.maxTenure - p.tenure) / p.maxTenure;
    }, 0) / sectorPeople.length;
    const tenureScore = tenureMargin * 40;
    
    // メンタリング関係の密度
    const highSkillCount = sectorPeople.filter(p => 
      Object.values(p.skills).reduce((a,b) => a+b, 0) / CAPABILITY_AXES.length > 50
    ).length;
    const mentorScore = (highSkillCount / sectorPeople.length) * 30;
    
    score += (ageScore + tenureScore + mentorScore) / 3;
  });
  
  return score / sectors.length;
};

// 目標プロファイル
const targetCapability = {
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

export default function TalentDevelopmentSimulator() {
  const [year, setYear] = useState(0);
  const [budget, setBudget] = useState(1000);
  const [individuals, setIndividuals] = useState(initialIndividuals);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [capability, setCapability] = useState(() => calculateNationalCapability(initialIndividuals));
  const [history, setHistory] = useState([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [events, setEvents] = useState([]);
  
  // 投資配分
  const [investments, setInvestments] = useState({
    university: 30,
    industry: 35,
    government: 15,
    research: 20,
  });

  // スコア計算
  function calculateScore(cap) {
    const values = Object.values(cap);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const min = Math.min(...values);
    return Math.round(avg * 0.6 + min * 0.4);
  }

  // 目標達成度
  function calculateAchievement(cap) {
    let dotProduct = 0, normCap = 0, normTarget = 0;
    CAPABILITY_AXES.forEach(axis => {
      dotProduct += (cap[axis.key] || 0) * targetCapability[axis.key];
      normCap += (cap[axis.key] || 0) ** 2;
      normTarget += targetCapability[axis.key] ** 2;
    });
    return (dotProduct / (Math.sqrt(normCap) * Math.sqrt(normTarget)) * 100).toFixed(1);
  }

  // 1年分のシミュレーション
  const simulateYear = useCallback(() => {
    const newEvents = [];
    
    setIndividuals(prev => {
      let updated = prev.map(person => {
        const newPerson = { ...person, skills: { ...person.skills } };
        newPerson.age += 1;
        newPerson.tenure += 1;
        
        // スキル成長（セクターと投資に応じて）
        const sectorInvestment = investments[person.sector] || 20;
        const growthRate = sectorInvestment / 100;
        
        CAPABILITY_AXES.forEach(axis => {
          let growth = 0;
          
          // セクター別成長特性
          if (person.sector === 'university') {
            if (['basicScience', 'education', 'innovation'].includes(axis.key)) {
              growth = growthRate * 3 * (person.role.includes('professor') ? 1.5 : 1);
            }
          } else if (person.sector === 'industry') {
            if (['appliedTech', 'manufacturing', 'digitalAI', 'implementation'].includes(axis.key)) {
              growth = growthRate * 3.5;
            }
          } else if (person.sector === 'government') {
            if (['policyMaking', 'finance'].includes(axis.key)) {
              growth = growthRate * 2.5;
            }
          }
          
          // 年齢による学習効率（若いほど成長速い）
          const ageEfficiency = Math.max(0.3, 1 - (person.age - 22) / 60);
          growth *= ageEfficiency;
          
          // 技術継承性は経験で上がる
          if (axis.key === 'succession') {
            growth = person.tenure * 0.5 + (person.age > 40 ? 2 : 0);
          }
          
          // 陳腐化
          const decay = axis.key === 'digitalAI' ? 2 : 0.5;
          
          newPerson.skills[axis.key] = Math.max(0, Math.min(100, 
            newPerson.skills[axis.key] + growth - decay + (Math.random() - 0.5) * 2
          ));
        });
        
        return newPerson;
      });
      
      // 退職・卒業イベント
      updated = updated.filter(person => {
        if (person.tenure >= person.maxTenure) {
          if (person.role.includes('student')) {
            newEvents.push(`📚 ${person.name} が卒業しました`);
          } else if (person.role === 'government_official') {
            newEvents.push(`🏛️ ${person.name} が異動しました（${person.tenure}年在籍）`);
          } else if (person.age >= 65) {
            newEvents.push(`🎓 ${person.name} が定年退職しました`);
          }
          return false;
        }
        return true;
      });
      
      // 新規人材追加（確率的）
      if (Math.random() < 0.3) {
        const newId = Math.max(...updated.map(p => p.id)) + 1;
        const roles = ['university_student_master', 'industry_engineer', 'government_official'];
        const role = roles[Math.floor(Math.random() * roles.length)];
        const sector = role.includes('university') ? 'university' : 
                       role.includes('industry') ? 'industry' : 'government';
        const baseSkills = {};
        CAPABILITY_AXES.forEach(axis => {
          baseSkills[axis.key] = 20 + Math.random() * 30;
        });
        
        const newPerson = createIndividual(
          newId,
          `新人${newId}`,
          sector,
          role,
          role.includes('student') ? 23 : 25 + Math.floor(Math.random() * 10),
          0,
          baseSkills
        );
        updated.push(newPerson);
        newEvents.push(`✨ ${newPerson.name} が${sector === 'university' ? '大学' : sector === 'industry' ? '産業界' : '政府'}に加入`);
      }
      
      return updated;
    });
    
    setEvents(prev => [...newEvents, ...prev].slice(0, 10));
    setYear(prev => prev + 1);
  }, [investments]);

  // 国力更新
  useEffect(() => {
    const newCap = calculateNationalCapability(individuals);
    newCap.succession = calculateSuccessionScore(individuals);
    setCapability(newCap);
    
    setHistory(prev => [...prev, {
      year,
      ...newCap,
      totalScore: calculateScore(newCap),
      headcount: individuals.length,
    }]);
  }, [year, individuals]);

  // 自動シミュレーション
  useEffect(() => {
    if (isSimulating && year < 20) {
      const timer = setTimeout(simulateYear, 800);
      return () => clearTimeout(timer);
    } else if (year >= 20) {
      setIsSimulating(false);
    }
  }, [isSimulating, year, simulateYear]);

  // レーダーチャート用データ
  const nationalRadarData = CAPABILITY_AXES.map(axis => ({
    axis: axis.name,
    current: capability[axis.key] || 0,
    target: targetCapability[axis.key],
  }));

  // 個人レーダーチャート用データ
  const getPersonRadarData = (person) => {
    if (!person) return [];
    return CAPABILITY_AXES.map(axis => ({
      axis: axis.name,
      value: person.skills[axis.key] || 0,
      target: targetCapability[axis.key] * 0.8, // 個人目標は国家目標の80%
    }));
  };

  // 5年後・10年後予測
  const predictFuture = (years) => {
    const recentHistory = history.slice(-3);
    if (recentHistory.length < 2) return capability;
    
    const trend = {};
    CAPABILITY_AXES.forEach(axis => {
      const values = recentHistory.map(h => h[axis.key] || 0);
      const avgChange = (values[values.length - 1] - values[0]) / values.length;
      trend[axis.key] = Math.max(0, Math.min(100, (capability[axis.key] || 0) + avgChange * years));
    });
    return trend;
  };

  const future5 = predictFuture(5);
  const future10 = predictFuture(10);

  const futureRadarData = CAPABILITY_AXES.map(axis => ({
    axis: axis.name,
    current: capability[axis.key] || 0,
    year5: future5[axis.key] || 0,
    year10: future10[axis.key] || 0,
    target: targetCapability[axis.key],
  }));

  // 在籍年数バーチャート
  const tenureData = individuals.map(p => ({
    name: p.name.slice(0, 4),
    tenure: p.tenure,
    remaining: Math.max(0, p.maxTenure - p.tenure),
    sector: p.sector,
  }));

  // リセット
  const resetSimulation = () => {
    setYear(0);
    setBudget(1000);
    setIndividuals(initialIndividuals);
    setCapability(calculateNationalCapability(initialIndividuals));
    setHistory([]);
    setIsSimulating(false);
    setEvents([]);
    setSelectedPerson(null);
  };

  // セクター別色
  const getSectorColor = (sector) => {
    switch(sector) {
      case 'university': return '#8b5cf6';
      case 'industry': return '#3b82f6';
      case 'government': return '#10b981';
      default: return '#6b7280';
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <h1 className="text-3xl font-bold text-center mb-2 text-cyan-400">
        🌏 国家人材育成シミュレーター v2
      </h1>
      <p className="text-center text-gray-400 mb-4">
        個人別能力 × 技術継承性 × セクター在籍期間モデル
      </p>
      
      {/* ステータスバー */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        <div className="bg-gray-800 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-yellow-400">{year}年目</div>
          <div className="text-gray-400 text-xs">経過年数</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-green-400">{individuals.length}</div>
          <div className="text-gray-400 text-xs">総人材数</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-blue-400">{calculateScore(capability)}</div>
          <div className="text-gray-400 text-xs">総合国力</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-purple-400">{calculateAchievement(capability)}%</div>
          <div className="text-gray-400 text-xs">目標達成度</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-orange-400">{(capability.succession || 0).toFixed(0)}</div>
          <div className="text-gray-400 text-xs">継承性スコア</div>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* 左：国力レーダーチャート */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h2 className="text-lg font-bold mb-2 text-cyan-300">📊 現在の国力</h2>
          <ResponsiveContainer width="100%" height={350}>
            <RadarChart data={nationalRadarData}>
              <PolarGrid stroke="#444" />
              <PolarAngleAxis dataKey="axis" tick={{ fill: '#aaa', fontSize: 9 }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#666', fontSize: 8 }} />
              <Radar name="現在" dataKey="current" stroke="#00ffff" fill="#00ffff" fillOpacity={0.3} strokeWidth={2} />
              <Radar name="目標" dataKey="target" stroke="#ff6b6b" fill="transparent" strokeDasharray="5 5" />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* 中央：5年後・10年後予測 */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h2 className="text-lg font-bold mb-2 text-orange-300">🔮 将来予測</h2>
          <ResponsiveContainer width="100%" height={350}>
            <RadarChart data={futureRadarData}>
              <PolarGrid stroke="#444" />
              <PolarAngleAxis dataKey="axis" tick={{ fill: '#aaa', fontSize: 9 }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#666', fontSize: 8 }} />
              <Radar name="現在" dataKey="current" stroke="#00ffff" fill="#00ffff" fillOpacity={0.1} />
              <Radar name="5年後" dataKey="year5" stroke="#ffd700" fill="#ffd700" fillOpacity={0.2} />
              <Radar name="10年後" dataKey="year10" stroke="#ff4500" fill="#ff4500" fillOpacity={0.2} />
              <Radar name="目標" dataKey="target" stroke="#888" fill="transparent" strokeDasharray="3 3" />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* 右：個人レーダーチャート */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h2 className="text-lg font-bold mb-2 text-pink-300">👤 個人プロファイル</h2>
          {selectedPerson ? (
            <>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">
                  {selectedPerson.sector === 'university' ? '🎓' : 
                   selectedPerson.sector === 'industry' ? '🏭' : '🏛️'}
                </span>
                <div>
                  <div className="font-bold">{selectedPerson.name}</div>
                  <div className="text-xs text-gray-400">
                    {selectedPerson.age}歳 / 在籍{selectedPerson.tenure}年 
                    (残{Math.max(0, selectedPerson.maxTenure - selectedPerson.tenure)}年)
                  </div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart data={getPersonRadarData(selectedPerson)}>
                  <PolarGrid stroke="#444" />
                  <PolarAngleAxis dataKey="axis" tick={{ fill: '#aaa', fontSize: 8 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#666', fontSize: 8 }} />
                  <Radar name="能力" dataKey="value" stroke={getSectorColor(selectedPerson.sector)} 
                         fill={getSectorColor(selectedPerson.sector)} fillOpacity={0.4} strokeWidth={2} />
                  <Radar name="目標" dataKey="target" stroke="#888" fill="transparent" strokeDasharray="3 3" />
                </RadarChart>
              </ResponsiveContainer>
            </>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500">
              下の人材リストから選択してください
            </div>
          )}
        </div>
      </div>

      {/* 人材リスト & 在籍年数 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        
        {/* 人材リスト */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h2 className="text-lg font-bold mb-3 text-green-300">👥 人材一覧（クリックで詳細）</h2>
          <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto">
            {individuals.map(person => (
              <div
                key={person.id}
                onClick={() => setSelectedPerson(person)}
                className={`flex items-center justify-between p-2 rounded cursor-pointer transition
                  ${selectedPerson?.id === person.id ? 'bg-gray-600 ring-2 ring-cyan-400' : 'bg-gray-700 hover:bg-gray-600'}`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">
                    {person.sector === 'university' ? '🎓' : 
                     person.sector === 'industry' ? '🏭' : '🏛️'}
                  </span>
                  <div>
                    <div className="font-medium text-sm">{person.name}</div>
                    <div className="text-xs text-gray-400">
                      {SECTOR_TENURE[person.role]?.name || person.role}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm">{person.age}歳</div>
                  <div className="text-xs text-gray-400">
                    在籍 {person.tenure}/{person.maxTenure}年
                  </div>
                  {person.tenure >= person.maxTenure - 1 && (
                    <span className="text-xs text-red-400">⚠️退職間近</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 在籍年数バーチャート */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h2 className="text-lg font-bold mb-3 text-yellow-300">📅 在籍期間状況</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={tenureData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#444" />
              <XAxis type="number" domain={[0, 40]} stroke="#888" />
              <YAxis type="category" dataKey="name" tick={{ fill: '#aaa', fontSize: 10 }} width={50} />
              <Tooltip contentStyle={{ backgroundColor: '#333', border: 'none' }} />
              <Bar dataKey="tenure" stackId="a" fill="#3b82f6" name="在籍年数" />
              <Bar dataKey="remaining" stackId="a" fill="#374151" name="残り期間" />
            </BarChart>
          </ResponsiveContainer>
          
          {/* 継承リスク警告 */}
          <div className="mt-2 text-xs">
            <div className="text-gray-400 mb-1">⚠️ 継承リスク:</div>
            {individuals.filter(p => p.tenure >= p.maxTenure - 2).length > 0 ? (
              <div className="text-red-400">
                {individuals.filter(p => p.tenure >= p.maxTenure - 2).map(p => p.name).join(', ')} が2年以内に退職予定
              </div>
            ) : (
              <div className="text-green-400">現在緊急の継承リスクなし</div>
            )}
          </div>
        </div>
      </div>

      {/* 投資配分 & イベントログ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        
        {/* 投資配分 */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h2 className="text-lg font-bold mb-3 text-green-300">💰 セクター別投資配分</h2>
          {[
            { key: 'university', icon: '🎓', name: '大学（基礎・教育）', tenure: '教授40年/学生2-6年' },
            { key: 'industry', icon: '🏭', name: '産業界（実践技術）', tenure: '3-5年サイクル' },
            { key: 'government', icon: '🏛️', name: '政府（政策）', tenure: '3年交代' },
            { key: 'research', icon: '🔬', name: '外部研究（先端）', tenure: '5-10年' },
          ].map(sector => (
            <div key={sector.key} className="mb-3">
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm">{sector.icon} {sector.name}</span>
                <span className="text-yellow-400 font-bold">{investments[sector.key]}%</span>
              </div>
              <input
                type="range" min="0" max="100" value={investments[sector.key]}
                onChange={(e) => setInvestments(prev => ({...prev, [sector.key]: parseInt(e.target.value)}))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
              <p className="text-gray-500 text-xs">{sector.tenure}</p>
            </div>
          ))}
          <div className="text-right mt-2">
            <span className={`font-bold ${Object.values(investments).reduce((a,b) => a+b, 0) === 100 ? 'text-green-400' : 'text-red-400'}`}>
              合計: {Object.values(investments).reduce((a,b) => a+b, 0)}%
            </span>
          </div>
        </div>

        {/* イベントログ */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h2 className="text-lg font-bold mb-3 text-purple-300">📋 イベントログ</h2>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {events.length > 0 ? events.map((event, i) => (
              <div key={i} className="text-sm text-gray-300 bg-gray-700 rounded p-2">
                {event}
              </div>
            )) : (
              <div className="text-gray-500 text-sm">シミュレーションを開始するとイベントが表示されます</div>
            )}
          </div>
        </div>
      </div>

      {/* 時系列グラフ */}
      <div className="bg-gray-800 rounded-lg p-4 mt-4">
        <h2 className="text-lg font-bold mb-3 text-yellow-300">📈 国力・継承性推移</h2>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={history}>
            <CartesianGrid strokeDasharray="3 3" stroke="#444" />
            <XAxis dataKey="year" stroke="#888" />
            <YAxis domain={[0, 100]} stroke="#888" />
            <Tooltip contentStyle={{ backgroundColor: '#333', border: 'none' }} />
            <Legend />
            <Line type="monotone" dataKey="totalScore" stroke="#00ffff" strokeWidth={3} name="総合スコア" dot={false} />
            <Line type="monotone" dataKey="succession" stroke="#9333ea" strokeWidth={2} name="技術継承性" dot={false} />
            <Line type="monotone" dataKey="basicScience" stroke="#8884d8" strokeWidth={1} name="基礎科学" dot={false} />
            <Line type="monotone" dataKey="implementation" stroke="#82ca9d" strokeWidth={1} name="社会実装力" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* コントロールボタン */}
      <div className="flex justify-center gap-4 mt-6 mb-4">
        <button onClick={simulateYear} disabled={isSimulating}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-bold transition disabled:opacity-50">
          ▶️ 1年進める
        </button>
        <button onClick={() => setIsSimulating(!isSimulating)}
          className={`px-6 py-3 rounded-lg font-bold transition ${isSimulating ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}>
          {isSimulating ? '⏸️ 停止' : '⏩ 自動実行'}
        </button>
        <button onClick={resetSimulation}
          className="px-6 py-3 bg-gray-600 hover:bg-gray-700 rounded-lg font-bold transition">
          🔄 リセット
        </button>
      </div>

      {/* 在籍期間モデル説明 */}
      <div className="bg-gray-800 rounded-lg p-4 mt-4">
        <h2 className="text-lg font-bold mb-3 text-cyan-300">📐 セクター別在籍期間モデル</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          {Object.entries(SECTOR_TENURE).map(([key, value]) => (
            <div key={key} className="bg-gray-700 rounded p-3">
              <div className="font-bold text-white">{value.name}</div>
              <div className="text-gray-400 mt-1">
                在籍: {value.min}〜{value.max}年
              </div>
              <div className="text-xs text-gray-500">平均: {value.avg}年</div>
            </div>
          ))}
        </div>
        <div className="mt-4 text-xs text-gray-400">
          <p><strong>技術継承性スコア</strong> = f(年齢分布多様性, 在籍余裕度, メンタリング密度)</p>
          <p className="mt-1">政界の短期サイクル（3年）と大学の長期安定（40年）の差が継承リスクに影響</p>
        </div>
      </div>
    </div>
  );
}
