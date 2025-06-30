# Lightning Explorer

An ultra-fast, keyboard-driven file explorer for **Windows 11** written with **Go + Wails v2** on the backend and **Preact + Tailwind CSS** on the frontend. Lightning Explorer focuses on raw speed, minimalist *Neo-Brutalism* aesthetics (no gradients or shadows 🚫), and a power-user feature-set that leaves the stock Explorer in the dust.

---

## ✨ Key Features

• **Streaming directory enumeration** – gigantic folders appear instantly thanks to a Go channel that delivers file metadata to the UI as it is read.

• **Virtualised lists** – the Preact frontend only renders what is on-screen, allowing tens-of-thousands of items to scroll butter-smoothly.

• **Rich context menus** (file, empty space, drive) with copy, cut, rename, hide, recycle-bin delete, permanent delete and PowerShell shortcuts.

• **Native drag-and-drop** with accurate visual feedback between drives, folders, the clipboard and external applications.

• **Full keyboard control** – familiar shortcuts (Ctrl-C/V/X, F2, Delete, Alt-Up, F5, etc.) plus multi-file navigation with arrow keys.

• **Clipboard & drive hot-plug awareness** – live updates when media is mounted or ejected and when clipboard contents change.

• **Inspect mode** for on-the-fly UI introspection during development.

• **Neo-Brutalist UI** – sharp rectangles, solid colours, 1 px borders, no gradients, no drop-shadows. Looks great on light or dark Windows 11 themes.

---

## 🏗️ Tech Stack

| Layer | Tech | Notes |
|-------|------|-------|
| Backend | Go 1.23 +, Wails v2.10 | Windows-only build that talks to Win32 & Shell API for file operations. |
| Frontend | Preact 10, Tailwind CSS v3, Vite | Ultra-small bundle (~ 3 KB gzip for Preact core). |
| Package Manager | **Bun 1.x** | Replaces npm/yarn/pnpm – lightning-fast installs & scripts. |
| IPC | Wails event bus + MsgPack | Streams file info efficiently. |

---

## 📂 Repository Layout

```
├─ backend/            # Go code that touches the Windows API
│  ├─ app.go           # Application lifecycle & bridge exports
│  ├─ filesystem.go    # Low-level file/drive helpers
│  └─ …
├─ frontend/
│  ├─ src/
│  │  ├─ components/   # Preact components (ContextMenu, Sidebar, …)
│  │  ├─ hooks/        # Reusable logic (useDragAndDrop, useClipboard, …)
│  │  └─ utils/        # Pure helpers & MsgPack serializers
│  ├─ tailwind.config.js
│  └─ vite.config.js
├─ main.go             # Small bootstrap that starts Wails
├─ wails.json          # Project metadata & Bun-powered scripts
└─ README.md
```

---

## ▶️ Getting Started (Development)

> All commands below are **PowerShell** because the project is Windows-only. Replace paths as needed.

1. **Install Go 1.23+**
   ```powershell
   winget install Go.Go
   ```

2. **Install Bun (>= 1.0.0)** – the lightning-fast JavaScript runtime & package manager.
   ```powershell
   iwr https://bun.sh/install.ps1 -useb | iex
   ```

3. **Install Wails CLI** (adds the `wails` command).
   ```powershell
   go install github.com/wailsapp/wails/v2/cmd/wails@latest
   $env:Path += ';' + (go env GOPATH) + '\bin'
   ```

4. **Clone & bootstrap the repo**
   ```powershell
   git clone https://github.com/yourname/lightning-explorer.git
   cd lightning-explorer
   bun install    # installs frontend deps; Go modules are resolved automatically
   ```

5. **Start the live-reload dev environment**
   ```powershell
   wails dev      # spawns Bun + Vite + Wails hot-reload server
   ```

A window will appear almost instantly. Any change inside `frontend/src/` or the Go backend will hot-reload within 100–300 ms.

---

## 📦 Production Build

```powershell
wails build -clean
```

* The command outputs `build/bin/lightning_explorer.exe` (self-contained, ~10 MB).
* Pass `-upx` to compress the binary further (UPX must be in `PATH`).
* Create an installer with [Inno Setup](https://jrsoftware.org/isinfo.php) or your favourite packager.

---

## 🔒 Security / Sandboxing

Lightning Explorer only targets Windows 11 and uses the same NTFS permissions as Explorer itself. Destructive operations (permanent delete) trigger confirmation dialogs by default.

---

## 📈 Performance Notes

```
50k items  👉  <160 ms initial paint, <50 MB RAM
500k items 👉  Still smooth thanks to streaming + virtualisation
```

Benchmarks run on Ryzen 7 7840HS, Go 1.23, Windows 11 23H2.

---

## 🗺️  High-level Architecture

```mermaid
flowchart LR
    subgraph Frontend [Preact/Tailwind]
        A[Virtualised File List]
        B[Context & Dialog System]
        C[Hooks (Clipboard, DnD, ...)]
    end
    subgraph Wails_Bridge [Wails >=2.10]
        D[MsgPack IPC]
    end
    subgraph Backend [Go]
        E[Filesystem & Win32 API]
        F[Drive Monitor]
    end
    A -- select/drag --> A
    A -- emits events --> B
    B -->|invoke| D
    D -->|channel| E
    E -- stream entries --> D
    D --> A
    F -- drive events --> D --> B
```

---

## 🤝 Contributing

PRs are welcome! Please follow these guidelines:

1. **Always use Bun** – never add `package-lock.json`/`yarn.lock`.
2. **No shadows, no gradients** – keep the Neo-Brutalist style.
3. **Go FMT & `bun run lint`** must pass before commit.
4. Windows 11 only – other OSes already have good enough file explorers.

---

## 📜 License

[MIT](LICENSE) – because sharing is caring.

---

### Acknowledgements

* [Wails](https://wails.io/) for making desktop apps *fun* in Go.
* [Preact](https://preactjs.com/) for the tiny yet powerful UI library.
* [Tailwind CSS](https://tailwindcss.com/) for rapid styling.
* Iconography from [Phosphor Icons](https://phosphoricons.com/) (MIT-licensed).

---

Happy exploring ⚡ 