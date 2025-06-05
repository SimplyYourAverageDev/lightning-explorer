# ⚡ Lightning Explorer

A blazingly fast file explorer for Windows 11 ONLY with retro 8-bit aesthetics and zen minimalism, built with Wails V2 and Preact. Now featuring **MessagePack** serialization for 50-70% faster data transfer!

## 🚀 Features

### Core Functionality
- **Lightning-fast navigation** with real-time directory updates
- **Drag & drop support** for intuitive file operations
- **Multi-selection** with keyboard shortcuts (Ctrl+A, Shift+Click)
- **Copy/Cut/Paste** with visual feedback
- **Context menus** for right-click operations
- **Breadcrumb navigation** for quick path traversal
- **Hidden file toggle** to show/hide system files
- **Virtualized file lists** for smooth performance with large directories

### 🔥 NEW: MessagePack Performance Optimization
- **50-70% smaller** data payloads compared to JSON
- **Up to 5x faster** serialization/deserialization
- **Real-time benchmarking** to monitor performance gains
- **Runtime switching** between JSON and MessagePack modes
- **Backward compatibility** with automatic fallback

### Advanced Features
- **PowerShell integration** - open terminal in current directory
- **System Explorer integration** - launch Windows Explorer
- **Inspect Mode (F7)** - developer tools for UI debugging
- **Keyboard shortcuts** for power users
- **Custom styling** with retro computer aesthetics
- **Performance monitoring** with navigation timing

## 📊 Performance Improvements

With MessagePack enabled:
```
Directory with 100 files:
JSON:        2,847 bytes
MessagePack: 1,421 bytes
Improvement: 50.1% smaller, ~3x faster loading
```

## 🛠 Technology Stack

### Backend (Go)
- **Wails V2** - Go + Web frontend framework
- **MessagePack** - High-performance binary serialization
- **Modular architecture** with dependency injection
- **Cross-platform compatibility**

### Frontend (JavaScript/Preact)
- **Preact** - Lightweight React alternative
- **Vite** - Lightning-fast build tool
- **TailwindCSS** - Utility-first CSS framework
- **Custom hooks** for state management
- **MessagePack decoder** for optimized data handling

## 🎯 Getting Started

### Prerequisites
- Go 1.23+
- Node.js 18+ (or Bun.js)
- Windows 11 (primary target)

### Installation
```bash
# Clone the repository
git clone https://github.com/yourusername/lightning-explorer.git
cd lightning-explorer

# Install Go dependencies
go mod tidy

# Install frontend dependencies
cd frontend
bun install  # or npm install

# Build and run
cd ..
wails dev
```

### Production Build
```bash
wails build
```

## 🎮 Usage

### Basic Navigation
- **Click folders** to navigate
- **Double-click files** to open with default application
- **Use breadcrumbs** for quick navigation to parent directories
- **Arrow keys** for keyboard navigation

### File Operations
- **Right-click** for context menu with copy/cut/paste/delete
- **Drag files** to folders for move/copy operations
- **Hold Ctrl** while dragging to copy instead of move
- **Ctrl+C/X/V** for standard clipboard operations

### MessagePack Features
- **Toolbar dropdown** to switch serialization modes
- **Benchmark button** to measure performance improvements
- **Console logs** showing size comparisons

### Keyboard Shortcuts
- `F5` - Refresh current directory
- `Backspace` - Navigate up one level
- `Ctrl+A` - Select all files
- `Del` - Move to recycle bin
- `Shift+Del` - Permanent delete
- `F2` - Rename selected file
- `F7` - Toggle inspect mode

## 🏗 Architecture

### Backend Structure
```
backend/
├── app.go              # Main app and API methods
├── types.go            # Data structures with dual serialization
├── serialization.go    # MessagePack utilities and benchmarking
├── filesystem.go       # File system operations
├── fileops.go          # File manipulation
├── platform.go         # OS-specific functionality
└── drives.go           # Drive management
```

### Frontend Structure
```
frontend/src/
├── app.jsx                    # Main application component
├── utils/
│   ├── serialization.js      # MessagePack handling
│   └── logger.js             # Logging utilities
├── components/               # Reusable UI components
├── hooks/                    # Custom React hooks
└── styles/                   # CSS and styling
```

## 📈 Performance Monitoring

The app includes built-in performance monitoring:
- **Navigation timing** displayed in header
- **Serialization benchmarks** comparing JSON vs MessagePack
- **Real-time size reduction** percentages
- **Console logging** with detailed performance metrics

## 🔧 Development

### Adding New Features
When adding new data structures:
1. Add both JSON and MessagePack tags to structs
2. Update serialization utilities for new types
3. Test with both serialization modes

### MessagePack Integration
```go
// Backend struct
type NewData struct {
    Field string `json:"field" msgpack:"field"`
}

// Frontend deserialization
const data = serializationUtils.deserialize(response);
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Wails** team for the excellent Go + Web framework
- **MessagePack** community for the efficient serialization format
- **Preact** team for the lightweight React alternative
- Retro computing aesthetics inspired by classic file managers

---

**Lightning Explorer** - Where retro meets performance ⚡ 