<div align="center">

# 📸 FilmFare

**A retro-inspired digital photobooth experience — capture, customize, and create.**

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Fabric.js](https://img.shields.io/badge/Fabric.js-Canvas-blue?style=for-the-badge)
![MIT License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

*Snap. Style. Export. Repeat.*

</div>

---

## Overview

FilmFare is a browser-based digital photobooth built for the nostalgic at heart. Powered by React, Vite, and Fabric.js, it lets users capture photos directly from their webcam, layer them with stickers and text, apply retro-themed layouts, and export finished creations in multiple formats — all without leaving the browser.

No installs. No accounts. Just vibes.

---

## ✨ Features

### 📷 Photo Capture
- Live webcam capture with a countdown timer before each shot
- Single-photo and multi-photo layout support
- Upload existing photos from your device

### 🎨 Customization Studio
- Drag-and-drop sticker system
- Custom text overlays with full positioning control
- Multiple visual themes to set the mood
- Real-time editing canvas powered by Fabric.js

### 🖼️ Layout Templates
| Layout | Status |
|---|---|
| Classic Polaroid | ✅ Available |
| Retro Digicam | ✅ Available |
| 3-Photo Film Strip | ✅ Available |
| 5-Photo Film Strip | 🔜 Coming Soon |

### 💾 Export Formats
| Format | Best For |
|---|---|
| PNG | High-quality archiving |
| JPEG | Easy sharing |
| WEBP | Compressed, web-optimized |

### 📱 Responsive by Default
- Mobile-friendly interface with full touch support
- Sticker dragging and canvas editing work on touch devices
- Optimized for all modern browsers

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend Framework | React + Vite |
| Canvas & Editing | Fabric.js |
| Styling | CSS3 + Custom Retro UI Components |
| Camera | WebRTC Camera API |
| Rendering | HTML5 Canvas |
| Language | JavaScript (ES6+) |

---

## 📂 Project Structure

```
FilmFare/
├── public/
│   ├── stickers/                  # Sticker asset library
│   └── retro_camera_frame.png     # Decorative camera overlay
│
└── src/
    ├── assets/                    # Static assets
    ├── components/
    │   ├── CameraCapture.jsx      # Webcam capture + countdown logic
    │   ├── EditorStudio.jsx       # Fabric.js editing workspace
    │   ├── LayoutPicker.jsx       # Template selection UI
    │   ├── LoadingExport.jsx      # Export progress handler
    │   └── MarqueeHeader.jsx      # Animated retro header
    ├── utils/
    │   ├── audioManager.js        # Sound effects manager
    │   ├── layoutConfig.js        # Layout definitions and config
    │   └── stickerStore.js        # Sticker registry and state
    ├── App.jsx
    └── main.jsx
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js v18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/sammmiksha/Photobooth.git
cd Photobooth

# Install dependencies
npm install

# Start development server
npm run dev
```

### Build & Preview

```bash
# Production build
npm run build

# Preview production build locally
npm run preview
```

---

## 🌟 Current Highlights

- Interactive Fabric.js workspace with real-time sticker and text editing
- Retro Digicam template with decorative overlays baked in
- Multi-format export pipeline (PNG, JPEG, WEBP)
- Layout-based photo workflows for consistent framing
- Draggable sticker system with touch support

---

## 🔮 Roadmap

- [ ] 5-Photo Film Strip template
- [ ] Photo filters and effects
- [ ] Animated stickers (GIF support)
- [ ] Custom frame marketplace
- [ ] QR code sharing
- [ ] Cloud save functionality
- [ ] Social media export presets

---

## 👩‍💻 Author

**Samiksha Patil**
BSc Information Technology — Mumbai University

Full-Stack Developer • Backend-Focused • AI-Integrated Systems

[![GitHub](https://img.shields.io/badge/GitHub-sammmiksha-181717?style=flat-square&logo=github)](https://github.com/sammmiksha)

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

<div align="center">

*Built with care, a lot of CSS, and an unhealthy love for retro aesthetics.*

</div>
