# 技術ノート: Version 2
## 個人モデル・技術継承性導入フェーズ

---

## 1. バージョン情報

| 項目 | 内容 |
|------|------|
| バージョン | v2.0 |
| 開発段階 | 個人追跡モデル実装 |
| 主な成果物 | インタラクティブシミュレーター |
| 対象規模 | 個人ベース（〜数百名追跡可能） |

---

## 2. v1からの主要変更点

| 機能 | v1 | v2 |
|------|-----|-----|
| 個人プロファイル | 概念のみ | 完全実装 |
| 個人レーダーチャート | なし | あり |
| 技術継承性 | なし | 新規導入 |
| 在籍期間モデル | なし | 新規導入 |
| イベントシステム | なし | 新規導入 |
| 医療軸 | あり | コメントアウト |

---

## 3. 技術継承性モデル

### 3.1 設計背景

**問題意識**: 
- 大学教授は40年在籍 → 長期的な知識継承が可能
- 政界は3年交代 → 継承が困難、知識断絶リスク
- 産業界は3-5年サイクル → OJTによる継承が重要

### 3.2 継承性スコア

$$\text{Succession}_s = \frac{1}{3} \left( \tilde{D}_{\text{age}} + \tilde{M}_{\text{tenure}} + \tilde{R}_{\text{mentor}} \right)$$

### 3.3 各成分の計算

#### 年齢分布多様性 $\tilde{D}_{\text{age}}$

$$\tilde{D}_{\text{age}} = \frac{\min(40, \text{ageRange})}{40} \times 100$$

- 若手〜シニアまで幅広い年齢層がいるほど高スコア
- 最大40歳差で満点

#### 在籍余裕度 $\tilde{M}_{\text{tenure}}$

$$\tilde{M}_{\text{tenure}} = \frac{T_{\max} - T_{\text{current}}}{T_{\max}} \times 100$$

- 在籍期間に余裕があるほど高スコア
- 退職間近の人材が多いと低スコア

#### メンタリング密度 $\tilde{R}_{\text{mentor}}$

$$\tilde{R}_{\text{mentor}} = \min\left(100, \frac{n_{\text{senior}}}{n_{\text{total}}} \times 300\right)$$

- シニア比率が高いほど高スコア
- 上限100で飽和

---

## 4. セクター別在籍期間

### 4.1 パラメータ定義

```javascript
const SECTOR_TENURE = {
  // 大学セクター
  university_professor: { 
    name: '大学教授', 
    min: 30, max: 40, avg: 35 
  },
  university_student_bachelor: { 
    name: '学部生', 
    min: 3, max: 4, avg: 4 
  },
  university_student_master: { 
    name: '修士', 
    min: 1, max: 2, avg: 2 
  },
  university_student_doctor: { 
    name: '博士', 
    min: 3, max: 5, avg: 3 
  },
  
  // 産業界
  industry_engineer: { 
    name: '産業界エンジニア', 
    min: 3, max: 5, avg: 4 
  },
  
  // 政府
  government_official: { 
    name: '政界・官僚', 
    min: 2, max: 3, avg: 3 
  },
  
  // 研究機関
  researcher: { 
    name: '外部研究者', 
    min: 5, max: 10, avg: 7 
  },
};
```

### 4.2 継承リスク閾値

| セクター | 危険 | 警告 | 安全 |
|---------|------|------|------|
| 大学（教授） | < 30 | 30-50 | > 50 |
| 産業界 | < 40 | 40-60 | > 60 |
| 政府 | < 50 | 50-70 | > 70 |

（政府は回転が速いため、閾値を高く設定）

---

## 5. 個人プロファイル構造

### 5.1 データ構造

```javascript
const createIndividual = (id, name, sector, role, age, tenure, skills) => ({
  id,              // 一意識別子
  name,            // 氏名
  sector,          // 所属セクター
  role,            // 役割（SECTOR_TENUREのキー）
  age,             // 年齢
  tenure,          // 現在の在籍年数
  maxTenure,       // 最大在籍年数（役割から自動設定）
  skills: {...skills},  // 12軸能力値（0-100）
  mentoring: 0,    // メンタリング能力
  successorCount: 0,  // 育成した後継者数
});
```

### 5.2 初期人材サンプル

```javascript
// 大学セクター
{ name: '山田教授', sector: 'university', role: 'professor', 
  age: 55, tenure: 25, basicScience: 90, education: 85, ... }

{ name: '田中（修士）', sector: 'university', role: 'master', 
  age: 24, tenure: 1, basicScience: 45, innovation: 40, ... }

// 産業界セクター
{ name: '佐藤（若手SE）', sector: 'industry', role: 'engineer', 
  age: 26, tenure: 2, appliedTech: 55, digitalAI: 70, ... }

{ name: '高橋（シニアEng）', sector: 'industry', role: 'engineer', 
  age: 45, tenure: 4, appliedTech: 85, manufacturing: 80, ... }
```

---

## 6. 成長モデル

### 6.1 能力成長方程式

$$\frac{d s_{i,j}}{dt} = \underbrace{\eta_{i,j}(a_i) \cdot T_{i,j}}_{\text{育成効果}} + \underbrace{\gamma \cdot W_i \cdot \mathbb{1}_{[\text{OJT}]}}_{\text{業務経験}} + \underbrace{\sum_k M_{ki} \cdot \delta_k \cdot s_{k,j}}_{\text{メンタリング}} - \underbrace{\mu_j \cdot s_{i,j}}_{\text{陳腐化}}$$

### 6.2 年齢依存学習効率

$$\eta_{i,j}(a_i) = \max\left(0.3, 1 - \frac{a_i - 22}{60}\right)$$

```
年齢 22: 効率 1.0 (最大)
年齢 40: 効率 0.7
年齢 60: 効率 0.37
年齢 82: 効率 0.3 (下限)
```

### 6.3 セクター別成長特性

```javascript
// 大学セクター
if (['basicScience', 'education', 'innovation'].includes(axis)) {
  growth = investmentRate * 3 * (isProfessor ? 1.5 : 1);
}

// 産業界セクター
if (['appliedTech', 'manufacturing', 'digitalAI', 'implementation'].includes(axis)) {
  growth = investmentRate * 3.5;
}

// 政府セクター
if (['policyMaking', 'finance'].includes(axis)) {
  growth = investmentRate * 2.5;
}
```

### 6.4 陳腐化率

```javascript
const decay = (axis === 'digitalAI') ? 2 : 0.5;
// デジタル・AI分野は陳腐化が速い
```

---

## 7. イベントシステム

### 7.1 イベントタイプ

```javascript
// 卒業イベント
"📚 田中（修士）が卒業しました"

// 異動イベント
"🏛️ 渡辺（官僚）が異動しました（3年在籍）"

// 定年退職
"🎓 山田教授が定年退職しました"

// 新規加入
"✨ 新人8 が産業界に加入"
```

### 7.2 退職判定ロジック

```javascript
if (person.tenure >= person.maxTenure) {
  if (person.role.includes('student')) {
    // 卒業
  } else if (person.role === 'government_official') {
    // 異動
  } else if (person.age >= 65) {
    // 定年退職
  }
  return false; // 人材リストから除外
}
```

---

## 8. UI/UX設計

### 8.1 画面構成

```
┌─────────────────────────────────────────────────────┐
│  ステータスバー: 年数 | 人材数 | 国力 | 継承性       │
├────────────────────┬──────────────────────────────┤
│  国力レーダー      │  5年後/10年後予測レーダー    │
├────────────────────┼──────────────────────────────┤
│  個人レーダー      │  人材リスト（クリック選択）   │
├────────────────────┼──────────────────────────────┤
│  投資配分          │  在籍年数バーチャート        │
├────────────────────┴──────────────────────────────┤
│  時系列グラフ | イベントログ                       │
└─────────────────────────────────────────────────────┘
```

### 8.2 インタラクション

- 人材リストをクリック → 個人レーダーチャート表示
- 投資スライダー調整 → リアルタイムで将来予測更新
- 退職間近の人材に警告アイコン表示

---

## 9. v2の限界と次バージョンへの課題

### 9.1 限界
- 個人追跡は計算量的に〜1000人が限界
- 標準化なし（軸間比較困難）
- 人口動態との連携なし

### 9.2 v3への課題
- [ ] コホートモデルへの移行（大規模化）
- [ ] 標準化（偏差値化）の導入
- [ ] 人口統計データとの連携
- [ ] 遷移行列による人材フローモデル

---

## 10. 成果物

- `talent-simulator-v2.jsx`: 個人追跡シミュレーター

---

*v2 技術ノート*
*作成日: 2024年*
