# 🌲🔌 GitPortree
**The VSCode extension that makes Git Worktree management feel effortless. / Git Worktree を VSCode で“最も快適に使えるようにする”拡張機能。**

GitPortree lets you manage every worktree visually in VSCode, automatically assigns ports per service inside a monorepo, and even switches theme colors per worktree so you always know where you are. その結果、複数ブランチの同時開発や Next.js / backend の並列起動が一気に整理され、Worktree ごとの使い分けが驚くほど快適になります。

👉 [Install from the VSCode Marketplace](https://marketplace.visualstudio.com/items?itemName=tatsuro13.gitportree) / [VSCode Marketplace からインストール](https://marketplace.visualstudio.com/items?itemName=tatsuro13.gitportree)

---

## ✨ Features / 機能一覧

### 🌲 Worktree Explorer / ワークツリーエクスプローラー
- View every worktree in a familiar TreeView with branch, path, age, and diff stats at a glance.
- ブランチ名 / パス / 経過日数 / 変更数を可視化し、サービスごとのポート割り当ても同時に確認できます。

### 🔌 Auto Port Assignment / 自動ポート割り当て（衝突ゼロ）
- Hash-based base ports + worktree offsets keep ports deterministic yet collision-free; `.env.local` files are created/updated automatically.
- lsof ベースの衝突検知で安全に再割り当てし、すべて“設定なし・完全自動”で完結します。

### 🎨 Automatic VSCode Colors / Worktree ごとのテーマ切替
- Activity/Status/Title bars recolor themselves per worktree (Dark Blue / Dark Green / Dark Yellow) to avoid accidental edits.
- 開いた Worktree に応じて VSCode の UI 色が切り替わり、誤操作を強力に防ぎます。

### 🛠 Utilities / 便利機能
- Open worktrees in VSCode, terminals, Finder, or with split windows in a single click.
- Worktree の削除やポート情報のコピーなど、日常作業を一括でこなすアクションを収録しています。

### 📌 Options / オプション
- Hover details, recent worktree shortcuts, and Git change badges (`●3` etc.) keep context at your fingertips.
- Hover 詳細や Recent Worktrees、Git 変更バッジなどのオプションを用意しています。

---

## 🧩 Monorepo Ready / モノレポ完全対応
複数サービスのポートを安全に割り当てます：
```
frontend → 3021 (+offset)
backend → 4095 (+offset)
admin → 5099 (+offset)
```
Each service reserves a 100-port “zone,” so offsets never push one service into another’s range (e.g., frontend 3000–3099, backend 4000–4099). Port allocation stays stable between sessions, so you can spin up frontend/backend/admin together without guessing. サービスごとに 100 ポート刻みでゾーンを区切っているため、offset を増やしても衝突せず、Worktree を無限に増やせます。

---

## 🚀 Local Installation / インストール方法（ローカル）
```
git clone https://github.com/tatsuro13/gitportree
cd gitportree
npm install
npm run build
code --install-extension gitportree-0.0.1.vsix
```
Use a newer `.vsix` file if you have one; VSCode picks up the latest build instantly. 新しい `.vsix` があればそちらを指定してください。

---

## 🖥 UI Preview / UI プレビュー
> Insert GIFs for Worktree Explorer, color switching, and automatic port assignment. Worktree Explorer / カラー切替 / ポート自動割り当ての GIF を挿入。

---

## ⚙ Commands / コマンド一覧

| Command | Description / 概要 |
|---------|---------------------|
| `GitPortree: Create Worktree` | Create a fresh worktree / 新しい Worktree を作成 |
| `GitPortree: Open Worktree` | Open the selected worktree / 選択した Worktree を開く |
| `GitPortree: Remove Worktree` | Safely delete a worktree / 安全に Worktree を削除 |
| `GitPortree: Copy Port Info` | Copy assigned ports / ポート割り当て情報をコピー |
| `GitPortree: Refresh` | Refresh all data / リフレッシュ |

---

## 📁 Project Structure / ディレクトリ構成
```
src/
  extension.ts
  worktree/
  port/
  color/
  utils/
```
Each folder stays focused: `worktree/` handles Git integration, `port/` resolves assignments, and `color/` tweaks VSCode themes. 役割ごとにディレクトリが分かれているので迷いません。

---

## ⚖ License / ライセンス
MIT License

---

## 👤 Author / 開発者
Created by **tatsuro13**. 気軽に Issue / PR をどうぞ。
