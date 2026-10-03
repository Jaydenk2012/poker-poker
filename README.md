# Neon Poker Arena

A premium, responsive poker-inspired card arena built with vanilla HTML/CSS/JS, Node.js, Express, and Socket.IO.

## Features
- Single-player mode with 1–4 AI opponents.
- Easy / Medium / Hard AI levels.
- Multiplayer room codes using Socket.IO.
- Texas Hold'em-style private cards + flop / turn / river + showdown.
- Starting score of 1,000 chips per player.
- Chips are non-monetary game score only.
- Responsive dark/neon casino-inspired UI.
- Self-contained SVG visual assets.

## Render deployment
Create a Render **Web Service** from this repository.

**Build Command**
```bash
npm install && npm run build
```

**Start Command**
```bash
npm start
```

No environment variables are required. Render supplies `PORT` automatically.

## Local run
```bash
npm install
npm run build
npm start
```
Then open `http://localhost:10000`.
