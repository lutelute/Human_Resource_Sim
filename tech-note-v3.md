# 技術ノート: Version 3
## コホートモデル・標準化・人口統計連動フェーズ

---

## 1. バージョン情報

| 項目 | 内容 |
|------|------|
| バージョン | v3.0 |
| 開発段階 | 大規模シミュレーション対応 |
| 主な成果物 | 人口統計連動シミュレーター |
| 対象規模 | 46万人（コホート集約） |

---

## 2. v2からの主要変更点

| 機能 | v2 | v3 |
|------|-----|-----|
| 人材規模 | 〜数百名 | 46万人 |
| 追跡方式 | 個人 | コホート |
| 標準化 | なし | 偏差値化 |
| 人口統計 | なし | 完全連動 |
| 遷移行列 | 簡易 | 完全実装 |
| 表示切替 | なし | 偏差値/実値 |

---

## 3. コホートモデル

### 3.1 設計思想

**課題**: 個人追跡では10万人規模のシミュレーションが困難

**解決策**: 類似属性の人材を「コホート」として集約

$$\text{個人} \times 100,000 \rightarrow \text{コホート} \times 14$$

### 3.2 コホート定義

```javascript
const Cohort = {
  id: string,           // 一意識別子
  sector: string,       // 所属セクター
  role: string,         // 役割名
  count: number,        // 人数
  avgAge: number,       // 平均年齢
  avgTenure: number,    // 平均在籍年数
  maxTenure: number,    // 最大在籍年数
  skills: {
    [axisKey]: {
      mean: number,     // 能力平均
      std: number,      // 能力標準偏差
    }
  }
};
```

### 3.3 14コホート構成

#### 大学セクター（6万人）

| ID | 役割 | 人数 | 平均年齢 | 在籍期間 |
|----|------|------|---------|---------|
| prof_senior | シニア教授 | 3,000 | 58 | 40年 |
| prof_mid | 中堅教授 | 2,000 | 45 | 40年 |
| assist_prof | 助教・ポスドク | 10,000 | 33 | 15年 |
| phd_student | 博士課程 | 15,000 | 27 | 5年 |
| master_student | 修士課程 | 30,000 | 24 | 2年 |

#### 産業界セクター（30万人）

| ID | 役割 | 人数 | 平均年齢 | 在籍期間 |
|----|------|------|---------|---------|
| ind_senior | シニアエンジニア | 50,000 | 52 | 5年 |
| ind_mid | 中堅エンジニア | 150,000 | 38 | 5年 |
| ind_junior | 若手エンジニア | 100,000 | 28 | 5年 |

#### 政府セクター（5万人）

| ID | 役割 | 人数 | 平均年齢 | 在籍期間 |
|----|------|------|---------|---------|
| gov_executive | 幹部官僚 | 5,000 | 55 | 3年 |
| gov_mid | 中堅官僚 | 20,000 | 42 | 3年 |
| gov_junior | 若手官僚 | 25,000 | 30 | 3年 |

#### 研究機関セクター（5万人）

| ID | 役割 | 人数 | 平均年齢 | 在籍期間 |
|----|------|------|---------|---------|
| res_senior | シニア研究者 | 10,000 | 52 | 10年 |
| res_mid | 中堅研究者 | 25,000 | 40 | 10年 |
| res_junior | 若手研究者 | 15,000 | 32 | 10年 |

---

## 4. 標準化（偏差値化）

### 4.1 Z-score変換

$$z_{i,j} = \frac{s_{i,j} - \mu_j}{\sigma_j}$$

- $s_{i,j}$: 人材（コホート）$i$ の軸 $j$ における能力値
- $\mu_j$: 軸 $j$ の全体平均
- $\sigma_j$: 軸 $j$ の全体標準偏差

### 4.2 偏差値変換

$$T_{i,j} = 50 + 10 \times z_{i,j}$$

| 偏差値 | 意味 |
|-------|------|
| 70 | 上位2.3%（+2σ） |
| 60 | 上位15.9%（+1σ） |
| 50 | 平均 |
| 40 | 下位15.9%（-1σ） |
| 30 | 下位2.3%（-2σ） |

### 4.3 実装コード

```javascript
const standardize = (value, mean, std) => {
  if (std === 0) return 50;
  return 50 + 10 * ((value - mean) / std);
};

const calculateGlobalStats = (cohorts) => {
  const stats = {};
  CAPABILITY_AXES.forEach(axis => {
    let totalSum = 0;
    let totalCount = 0;
    
    cohorts.forEach(cohort => {
      totalSum += cohort.skills[axis.key].mean * cohort.count;
      totalCount += cohort.count;
    });
    
    const globalMean = totalSum / totalCount;
    // 標準偏差も同様に計算
    stats[axis.key] = { mean: globalMean, std: calculatedStd };
  });
  return stats;
};
```

### 4.4 表示切替機能

```javascript
const [viewMode, setViewMode] = useState('normalized'); // or 'raw'

const capability = viewMode === 'normalized' 
  ? capabilityNorm  // 偏差値表示
  : capabilityRaw;  // 実値表示（0-100）
```

---

## 5. 人口統計連動

### 5.1 基本パラメータ（2024年基準）

```javascript
const POPULATION_STATS = {
  baseYear: 2024,
  
  agePopulation: {
    age18: 110,  // 18歳人口: 110万人
    age22: 115,  // 22歳人口: 115万人
    age24: 118,  // 24歳人口: 118万人
    age27: 120,  // 27歳人口: 120万人
  },
  
  rates: {
    universityEnrollment: 0.56,  // 大学進学率 56%
    masterEnrollment: 0.12,      // 修士進学率 12%
    phdEnrollment: 0.10,         // 博士進学率 10%
    phdToAcademia: 0.18,         // 博士→アカデミア 18%
    phdToIndustry: 0.42,         // 博士→産業界 42%
    phdToResearch: 0.30,         // 博士→研究機関 30%
    masterToIndustry: 0.75,      // 修士→産業界 75%
    masterToGov: 0.12,           // 修士→官僚 12%
    bachelorToIndustry: 0.82,    // 学部→産業界 82%
    bachelorToGov: 0.08,         // 学部→官僚 8%
  },
  
  annualDeclineRate: 0.012,  // 年間1.2%減少
};
```

### 5.2 人口減少予測

```javascript
projections: {
  2025: 0.99,  // 基準年の99%
  2030: 0.95,  // 基準年の95%
  2035: 0.90,  // 基準年の90%
  2040: 0.84,  // 基準年の84%
  2045: 0.78,  // 基準年の78%
  2050: 0.72,  // 基準年の72%
}
```

### 5.3 年間流入計算フロー

```
18歳人口 (110万人)
    │
    ├─× 人口減少係数 (年ごとに減少)
    │
    ▼
大学進学 (× 56%)
    │
    ├─→ 大学入学者: 61.6万人
    │
    ▼ (× 90% 卒業率)
学部卒業: 55.4万人
    │
    ├─→ 修士進学 (× 12%): 6.7万人
    │      │
    │      ▼ (× 92% 修了率)
    │   修士修了: 6.1万人
    │      │
    │      ├─→ 博士進学 (× 10%): 0.6万人
    │      │      │
    │      │      ▼ (× 70% 修了率)
    │      │   博士修了: 0.43万人
    │      │      │
    │      │      ├─→ アカデミア (18%): 770人
    │      │      ├─→ 産業界 (42%): 1,800人
    │      │      └─→ 研究機関 (30%): 1,290人
    │      │
    │      ├─→ 産業界 (× 75%): 4.1万人
    │      └─→ 政府 (× 12%): 0.66万人
    │
    ├─→ 産業界 (× 82%): 40万人
    └─→ 政府 (× 8%): 3.9万人
```

### 5.4 調整可能パラメータ（UI）

```javascript
const [popParams, setPopParams] = useState({
  masterEnrollment: 12,   // 修士進学率 (%)
  phdEnrollment: 10,      // 博士進学率 (%)
  phdToAcademia: 18,      // 博士→アカデミア (%)
});
```

これらのスライダーを調整すると、セクター別流入数がリアルタイムで変化。

---

## 6. 遷移行列（Transition Matrix）

### 6.1 定義

$$\mathbf{n}(t+1) = \mathbf{P}(t) \cdot \mathbf{n}(t) + \mathbf{b}(t)$$

- $\mathbf{n}(t)$: 各コホートの人数ベクトル
- $\mathbf{P}(t)$: 遷移確率行列
- $\mathbf{b}(t)$: 新規流入ベクトル

### 6.2 遷移確率

```javascript
const TRANSITION_MATRIX = {
  // 修士 → (博士進学は人口統計から)
  master_student: { 
    phd_student: 0.10,  // 内部昇進
    exit: 0.90          // 就職等
  },
  
  // 博士 → (進路は人口統計から)
  phd_student: { 
    assist_prof: 0.18,  // アカデミア
    exit: 0.82 
  },
  
  // 助教 → 
  assist_prof: { 
    prof_mid: 0.08,     // 准教授昇進
    ind_mid: 0.10,      // 産業界転職
    res_mid: 0.08,      // 研究機関転職
    exit: 0.05 
  },
  
  // 産業界若手 →
  ind_junior: { 
    ind_mid: 0.20,      // 昇進
    exit: 0.12          // 転職・退職
  },
  
  // 政府若手 →
  gov_junior: { 
    gov_mid: 0.28,      // 昇進
    exit: 0.08 
  },
  
  // 政府幹部 →
  gov_executive: { 
    retire: 0.18,       // 退職
    exit: 0.08          // 異動
  },
  // ...
};
```

---

## 7. 国力集約関数（コホート版）

### 7.1 CES型集約

$$S_j(t) = \sum_{c \in \mathcal{C}} n_c \cdot \left( \mu_{c,j} + \lambda \cdot \frac{\sigma_{c,j}}{\sqrt{n_c}} \cdot k_c \right)$$

- $n_c$: コホート $c$ の人数
- $\mu_{c,j}$: コホート $c$ の軸 $j$ 平均能力
- $\sigma_{c,j}$: コホート $c$ の軸 $j$ 標準偏差
- $k_c$: キーパーソン係数（上位5%の寄与）

### 7.2 キーパーソン寄与

```javascript
// 上位5%の貢献
const keyPersons = cohort.count * 0.05;
const keyPersonSkill = skill.mean + 1.645 * skill.std; // 上位5%点
keyPersonContribution += keyPersons * keyPersonSkill * 0.1;
```

### 7.3 総合スコア

$$\text{Score} = 0.6 \times \bar{S} + 0.4 \times \min_j S_j$$

- 平均値と最小値の加重平均
- **最小値ペナルティ**: 一つでも弱い軸があると大幅減点

---

## 8. 技術継承性（コホート版）

### 8.1 セクター別計算

```javascript
const calculateSuccessionScore = (cohorts) => {
  Object.keys(SECTORS).forEach(sector => {
    const sectorCohorts = cohorts.filter(c => c.sector === sector);
    
    // 年齢分布多様性
    const ageRange = Math.max(...ages) - Math.min(...ages);
    const ageScore = Math.min(40, ageRange) / 40 * 100;
    
    // 在籍余裕度（加重平均）
    const tenureMargin = Σ((maxTenure - avgTenure) / maxTenure * count) / totalCount;
    const tenureScore = tenureMargin * 100;
    
    // メンタリング密度
    const seniorRatio = seniorCount / totalCount;
    const mentorScore = Math.min(100, seniorRatio * 300);
    
    // 総合
    sectorScores[sector] = ageScore * 0.3 + tenureScore * 0.4 + mentorScore * 0.3;
  });
};
```

---

## 9. 将来予測

### 9.1 トレンド外挿

```javascript
const predictFuture = (years) => {
  const recent = history.slice(-5);
  
  CAPABILITY_AXES.forEach(axis => {
    const values = recent.map(h => h[axis.key]);
    const trend = (values[values.length - 1] - values[0]) / values.length;
    prediction[axis.key] = capability[axis.key] + trend * years;
  });
  
  return prediction;
};
```

### 9.2 予測レーダーチャート

- 現在 (青)
- 5年後予測 (金)
- 10年後予測 (赤)

---

## 10. UI/UX設計

### 10.1 画面構成

```
┌──────────────────────────────────────────────────────────┐
│  ヘッダー: 年(西暦) | 人材数 | 国力(実/偏) | 人口係数    │
├──────────────────────────────────────────────────────────┤
│  人口統計パネル                                          │
│  ┌────────┬────────┬────────┬────────┐                  │
│  │18歳人口│大学入学│修士入学│博士修了│ ← 現在値表示     │
│  └────────┴────────┴────────┴────────┘                  │
│  [修士進学率] [博士進学率] [博士→アカデミア] ← スライダー │
│  ┌────────┬────────┬────────┬────────┐                  │
│  │🎓大学 │🏭産業界│🏛️政府 │🔬研究 │ ← 年間流入数     │
│  └────────┴────────┴────────┴────────┘                  │
├────────────────────┬───────────────────────────────────┤
│  国力レーダー      │  将来予測レーダー                  │
├────────────────────┼───────────────────────────────────┤
│  投資配分          │  継承性ゲージ + 流入推移ミニグラフ │
├────────────────────┴───────────────────────────────────┤
│  時系列グラフ: 国力 + 継承性 + 人材数                    │
└──────────────────────────────────────────────────────────┘
```

---

## 11. 成果と今後の課題

### 11.1 v3の成果
- 46万人規模のシミュレーションを実現
- 人口減少の長期影響を予測可能
- 政策パラメータの感度分析が可能
- 偏差値による相対評価

### 11.2 今後の課題（v4以降）
- [ ] 最適化ソルバーとの連携
- [ ] 実際の政府統計データ連携
- [ ] 地域別・分野別の精緻化
- [ ] 国際人材流動のモデル化
- [ ] パレート最適解の探索

---

## 12. 成果物

- `talent-simulator-v3.jsx`: コホートモデル版
- `talent-simulator-v3-pop.jsx`: 人口統計連動版
- `talent-simulator-v3-spec.md`: 詳細仕様書

---

*v3 技術ノート*
*作成日: 2024年*
