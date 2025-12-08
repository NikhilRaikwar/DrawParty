# 🎨 DrawParty - Multiplayer Drawing Game

A real-time multiplayer drawing and guessing game inspired by Skribbl.io, built with modern web technologies.

![DrawParty](https://img.shields.io/badge/Status-Active-brightgreen) ![React](https://img.shields.io/badge/React-18.3-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue) ![Supabase](https://img.shields.io/badge/Lovable_Cloud-Enabled-purple)

## 🚀 Tech Stack

| Technology | Purpose |
|------------|---------|
| ⚛️ **React 18** | UI Framework with Hooks |
| 📘 **TypeScript** | Type-safe development |
| ⚡ **Vite** | Lightning-fast build tool |
| 🎨 **Tailwind CSS** | Utility-first styling |
| 🧩 **shadcn/ui** | Beautiful UI components |
| ☁️ **Lovable Cloud** | Backend, Database & Realtime |
| 🔄 **WebRTC** | Peer-to-peer voice chat |
| 📡 **Edge Functions** | Serverless signaling server |

## ✨ Features

### 🎮 Core Gameplay
- 🖌️ **Real-time Drawing Canvas** - Smooth drawing with multiple tools
- 🎯 **Word Guessing** - Guess what others are drawing
- ⏱️ **Timed Rounds** - Configurable round duration
- 🏆 **Live Scoreboard** - Track points in real-time
- 💬 **In-game Chat** - Send messages and guesses

### 🛠️ Drawing Tools
- ✏️ Pencil with adjustable brush size
- 🎨 Color palette with custom colors
- 🪣 Flood fill (paint bucket)
- ↩️ Undo/Redo support
- 🧹 Clear canvas
- 📥 Download artwork

### 🌐 Multiplayer Features
- 🏠 **Create & Join Rooms** - Share room codes with friends
- 👥 **Real-time Player Sync** - See players join/leave instantly
- 🔄 **Live Game State** - All actions sync across players
- 🤖 **Bot Players** - Add bots to fill rooms

### 🎙️ Voice Chat (WebRTC)
- 🔊 Join/Leave voice channel
- 🔇 Mute/Unmute controls
- 🗣️ Speaking indicators
- 📡 P2P audio streaming

### ⚙️ Game Settings
- 📝 Word difficulty (Easy/Medium/Hard)
- ⏰ Customizable round time
- 🔢 Adjustable max rounds
- 👤 Player limits

## 🆚 DrawParty vs Skribbl.io

| Feature | DrawParty | Skribbl.io |
|---------|-----------|------------|
| 🎙️ Voice Chat | ✅ Built-in WebRTC | ❌ Not available |
| 🤖 Bot Players | ✅ Available | ❌ Not available |
| ☁️ Self-hostable | ✅ Open source | ❌ Proprietary |
| 🎨 Download Art | ✅ Save drawings | ❌ Not available |
| 📱 Mobile Support | ✅ Touch optimized | ⚠️ Limited |
| 🔐 Private Rooms | ✅ Room codes | ✅ Available |
| ↩️ Undo/Redo | ✅ Full history | ❌ Limited |
| 🌙 Dark Mode | ✅ Themed | ❌ Light only |

## 🏗️ Architecture

![DrawParty Architecture Flowchart](public/drawparty.excalidraw.svg)

## 📦 Database Schema

- **rooms** - Game room configuration and state
- **room_players** - Players in each room with scores
- **room_messages** - Chat messages and guesses

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ & npm

### Installation

```bash
# Clone the repository
git clone <YOUR_GIT_URL>

# Navigate to project
cd <YOUR_PROJECT_NAME>

# Install dependencies
npm install

# Start development server
npm run dev
```

### 🎮 How to Play

1. **Create a Room** - Enter your name and create a new game
2. **Share Code** - Give the room code to friends
3. **Wait in Lobby** - Toggle ready when everyone joins
4. **Start Game** - Host starts when all are ready
5. **Draw & Guess** - Take turns drawing and guessing words
6. **Win!** - Player with most points wins 🏆

## 🔧 Environment Variables

The project uses Lovable Cloud which automatically configures:
- `VITE_SUPABASE_URL` - Backend API URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` - Public API key
- `VITE_SUPABASE_PROJECT_ID` - Project identifier

## 📁 Project Structure

```
src/
├── components/
│   ├── game/           # Game-specific components
│   │   ├── ChatBox.tsx
│   │   ├── DrawingCanvas.tsx
│   │   ├── GameHeader.tsx
│   │   ├── PlayerCard.tsx
│   │   ├── Scoreboard.tsx
│   │   ├── VoiceControls.tsx
│   │   └── WordSelection.tsx
│   ├── screens/        # Main screen layouts
│   │   ├── GameScreen.tsx
│   │   ├── HomeScreen.tsx
│   │   └── LobbyScreen.tsx
│   └── ui/             # Reusable UI components
├── hooks/
│   ├── useMultiplayerGame.ts  # Game state management
│   └── useVoiceChat.ts        # WebRTC voice chat
├── types/
│   └── game.ts         # TypeScript interfaces
└── integrations/
    └── supabase/       # Backend client
```

## 🛠️ Edge Functions

- **signaling** - Handles room creation, player management, game state updates, and ICE server configuration for WebRTC

## 📄 License

This project is open source and available under the MIT License.

## 🙏 Acknowledgments

- Inspired by [Skribbl.io](https://skribbl.io)
- Built with [Lovable](https://lovable.dev)
- UI components from [shadcn/ui](https://ui.shadcn.com)

---

Made with ❤️ using Lovable
