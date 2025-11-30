# 🌲🔌 GitPortree
**VS Code extension for managing Git worktrees with automatic port zoning and per-branch colors.**

GitPortree keeps every worktree visible in a dedicated VS Code explorer, assigns ports deterministically for each service in your monorepo, writes `.env.local` files, and recolors the VS Code UI per worktree so you always know which branch you are editing.

👉 [Install from the VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=tatsuro13.gitportree)

---

## ✨ Features

### 🌲 Worktree Explorer
- TreeView listing of every worktree with branch, filesystem path, age, and pending change count.
- Inline service nodes show the assigned port so you can inspect a worktree at a glance.

### 🔌 Automatic Port Assignment
- Service names are hashed inside a 100-port zone (3000–3099 for frontend, 4000–4099 for backend, 5000–5099 for admin, 5500–5599 for api, 6000+ for unknown).
- Worktree offsets are normalized into that zone, which guarantees that even if you open 10+ worktrees, one service never drifts into another service’s range.
- `.env.local` files are created or updated for each worktree with `SERVICE_NAME_PORT` keys plus a default `PORT`.
- lsof-backed collision checks reassign conflicting ports automatically, so you never tweak settings manually.

### 🎨 Worktree Colors
- Activity Bar, Status Bar, and Title Bar recolor themselves based on the branch name (Dark Blue / Green / Yellow variants).
- The instant color change makes it obvious when you switch to a different worktree and prevents accidental edits in the wrong branch.

### 🛠 Utility Actions
- Open a worktree in VS Code, terminal, Finder, or a split window with one click.
- Delete worktrees safely, copy port info to the clipboard, or jump between recent branches through quick picks.

### 📌 Options & Quality-of-Life
- Hover cards with detailed metadata, a Recent Worktrees section, Git change badges such as `Δ3`, and quick commands exposed through the command palette.

---

## 🧩 Port Allocation Model
```
frontend (base 3000) → 3000–3099
backend  (base 4000) → 4000–4099
admin    (base 5000) → 5000–5099
api      (base 5500) → 5500–5599
unknown  (base 6000) → 6000–6099
```
- Each service owns a 100-port zone. Hashing picks a stable slot within that zone, and the worktree offset simply rotates inside the same 100 ports.
- Example: Worktree #0 gets `frontend:3034`, Worktree #1 gets `frontend:3035`, yet backend stays in the 4000 block (`4012`, `4013`, …). Collisions cannot occur between service types, even with dozens of worktrees.
- Change the base ports in `WorktreeProvider.DEFAULT_BASE_PORTS` if your monorepo prefers different ranges.

---

## 🚀 Local Installation
```
git clone https://github.com/tatsuro13/gitportree
cd gitportree
pnpm install
pnpm run compile
code --install-extension gitportree-0.0.3.vsix
```
Use the latest `.vsix` artifact in the repository (0.0.3 or newer) when installing locally.

---

## 🖥 UI Preview
> Add GIFs for Worktree Explorer, automatic color switching, and port assignment.

---

## ⚙ Commands

| Command | Description |
|---------|-------------|
| `GitPortree: Create Worktree` | Create a worktree from an existing or new branch |
| `GitPortree: Open Worktree` | Reveal a worktree in VS Code |
| `GitPortree: Remove Worktree` | Remove the selected worktree safely |
| `GitPortree: Copy Port Info` | Copy service → port mappings |
| `GitPortree: Refresh` | Rescan all worktrees |
| `GitPortree: Change Worktree` | Switch to another worktree via Quick Pick |
| `GitPortree: Delete Worktree Branch` | Delete the branch that GitPortree manages |

---

## 📁 Project Structure
```
src/
  extension.ts          # Extension activation & command wiring
  worktree/             # Explorer, scanner, and command logic
  port/                 # Service detection + zone-aware port allocator
  color/                # Theme generation & VS Code color updates
  utils/                # Git CLI wrapper, env writer, helpers
```

---

## ⚖ License
MIT License

---

## 👤 Author
Created by **tatsuro13** — pull requests and issues welcome.
