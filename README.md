# 🌏 国家人材育成シミュレーター

**Human Capital Development Optimization Game**

[![GitHub Pages](https://img.shields.io/badge/demo-live-green.svg)](https://shigenoburyuto.github.io/Human_Resource_Sim/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## 🚀 ライブデモ

**[📊 シミュレーターを試す →](https://shigenoburyuto.github.io/Human_Resource_Sim/)**

---

## プロジェクト概要

限られた資源（予算・時間・人材）の中で、国力を最大化する人材育成戦略を探索するシミュレーションゲーム。最終的にはアカデミックな最適化問題として定式化。

---

## 🎯 解くべき問題

1. **投資配分問題**: 大学・産業界・政府・研究機関への最適投資比率
2. **人材配置問題**: 人材をどのセクターに配置するか
3. **継承性問題**: 技術・知識の世代間継承をどう確保するか

---

## 📁 ファイル構成

```
talent-development-simulator/
│
├── 📄 README.md                      # このファイル
│
├── 📊 シミュレーター
│   ├── talent-development-simulator.jsx  # v1: 基本版
│   ├── talent-simulator-v2.jsx           # v2: 個人モデル版
│   ├── talent-simulator-v3.jsx           # v3: コホート版
│   └── talent-simulator-v3-pop.jsx       # v3: 人口統計連動版
│
├── 📝 仕様書
│   └── talent-simulator-v3-spec.md       # 詳細仕様書
│
└── 📚 技術ノート
    ├── technical-notes-all-versions.md   # 全バージョン統合版
    ├── tech-note-v1.md                   # v1 技術ノート
    ├── tech-note-v2.md                   # v2 技術ノート
    └── tech-note-v3.md                   # v3 技術ノート
```

---

## 🚀 バージョン履歴

### Version 1: 基本設計
- 概念設計・数理モデル構築
- 12軸レーダーチャート
- CES型国力集約関数
- 最適化問題の定式化

### Version 2: 個人モデル
- 個人プロファイル追跡
- 技術継承性指標
- セクター別在籍期間モデル
- イベントシステム（退職・卒業）

### Version 3: 大規模シミュレーション
- コホートモデル（46万人対応）
- 標準化（偏差値化）
- 人口統計連動
- 遷移行列による人材フロー

---

## 📈 主要機能

### レーダーチャート（12軸）
- 基礎科学 / 応用技術 / デジタル・AI
- 製造 / 金融 / エネルギー
- 国際競争力 / イノベーション
- 教育基盤 / 政策立案 / 社会実装力
- 技術継承性

### 4セクター
| セクター | 特徴 | 在籍期間 |
|---------|------|---------|
| 🎓 大学 | 基礎研究・人材育成の土台 | 教授40年 / 学生2-6年 |
| 🏭 産業界 | 経験的技術・実践知 | 3-5年サイクル |
| 🏛️ 政府 | 投資配分・政策立案 | 3年交代 |
| 🔬 研究機関 | 高度専門知識・国際連携 | 5-10年 |

### シミュレーション機能
- 5年後・10年後の国力予測
- 人口減少の影響分析
- 政策パラメータ調整（進学率等）
- 偏差値/実値の切替表示

---

## 🔬 数理モデル

### 国力集約関数
$$S_j(t) = \left(\sum_{c} n_c \cdot \mu_{c,j}^{\alpha}\right)^{1/\alpha}$$

### 技術継承性
$$\text{Succession} = \frac{1}{3}(D_{\text{age}} + M_{\text{tenure}} + R_{\text{mentor}})$$

### 総合スコア
$$\text{Score} = 0.6 \times \bar{S} + 0.4 \times \min_j S_j$$

### 最適化問題
$$\max_{\mathbf{u}} \sum_{t=0}^{T} \gamma^t \left[ \text{Score}(t) + \lambda \cdot \text{Succession}(t) \right]$$

---

## 🎮 使い方

### オンライン版（推奨）
1. [デモサイト](https://shigenoburyuto.github.io/Human_Resource_Sim/)にアクセス
2. 使用したいバージョンを選択
3. 投資配分スライダーを調整
4. 「1年進める」または「自動実行」をクリック
5. レーダーチャートと時系列グラフで結果を確認

### ローカル実行
```bash
git clone https://github.com/shigenoburyuto/Human_Resource_Sim.git
cd Human_Resource_Sim
# Webサーバーを起動してindex.htmlを開く
python -m http.server 8000
# http://localhost:8000 にアクセス
```

---

## 📊 人口統計パラメータ（v3）

| パラメータ | デフォルト値 |
|-----------|-------------|
| 18歳人口（基準年） | 110万人 |
| 大学進学率 | 56% |
| 修士進学率 | 12% |
| 博士進学率 | 10% |
| 人口減少率 | 1.2%/年 |

---

## 🔮 今後の発展

1. **最適化ソルバー連携**: 自動最適化
2. **実統計データ連携**: 政府統計API
3. **地域・分野別精緻化**: より現実的なモデル
4. **国際比較**: 他国との戦略比較

---

## 📚 参考文献

- Arrow, K. J., et al. (1961). "Capital-labor substitution and economic efficiency" - CES生産関数
- Becker, G. S. (1964). "Human Capital" - 人的資本理論
- Nonaka, I., & Takeuchi, H. (1995). "The Knowledge-Creating Company" - 知識継承

---

## 🤝 Contributing

プロジェクトへの貢献を歓迎します！

1. このリポジトリをフォーク
2. 機能ブランチを作成 (`git checkout -b feature/AmazingFeature`)
3. 変更をコミット (`git commit -m 'Add some AmazingFeature'`)
4. ブランチにプッシュ (`git push origin feature/AmazingFeature`)
5. Pull Requestを開く

## 📄 License

このプロジェクトはMITライセンスの下で公開されています。詳細は [LICENSE](LICENSE) ファイルを参照してください。

---

*プロジェクト開始: 2024年 | GitHub Pages対応: 2025年*
