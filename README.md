# Lightning Explorer

A blazing-fast, minimalist file explorer for ONLY **Windows 11** (Sorry, Linux and MacOS's File Explorer is already good enouh), built with Wails V2 (Go + Preact). Engineered for performance and a responsive user experience.

## ✨ Features

*   **Speed & Performance Focused:**
    *   Native Win32 API (`FindFirstFileExW`) for rapid directory listing.
    *   Streaming data: Basic info loads instantly, details hydrate in the background.
    *   Optimized MessagePack (forced Base64 mode) for efficient API communication.
    *   Virtualized file lists (Preact) for smooth scrolling through large directories.
*   **Essential File Management:**
    *   Navigate (breadcrumbs, sidebar, up), view, open, create, rename.
    *   Copy, Cut, Move.
    *   Delete (Permanent & Native Windows Recycle Bin via `SHFileOperationW`).
    *   Show/hide hidden files (respects native Windows attributes via `GetFileAttributesW`).
*   **Windows Integration:**
    *   Open in system File Explorer.
    *   Open PowerShell 7 in current directory (via `ShellExecuteW`).
    *   Drive listing & Quick Access paths.
*   **Modern & Responsive UI:**
    *   Clean interface built with Preact & TailwindCSS.
    *   Context menus, keyboard shortcuts, internal Drag & Drop.

## 🚀 Tech Stack

*   **Framework:** Wails V2
*   **Backend:** Go
    *   Windows Native APIs (Win32, Shell32, Advapi32)
    *   Goroutines for concurrency
    *   MessagePack for serialization
*   **Frontend:** Preact
    *   Vite build tool
    *   TailwindCSS for styling
    *   Custom Hooks for state management
    *   MessagePack client-side decoding

## 🛠️ Building

Optimized build for Windows:
```bash
wails build -ldflags="-s -w" -trimpath
```
(Or run `build.ps1` if available)