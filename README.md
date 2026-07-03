# Omaxe DMS AI — Enterprise Claude Wrapper

A professional, full-stack chat application that serves as a secure wrapper for the Anthropic Claude API. Features enterprise-grade UI design with authentication, protected routing, and a real-time chat interface.

## Project Structure

```
Claude Wrapper/
├── server/                  # Express.js Backend
│   ├── index.js             # API server with /api/chat endpoint
│   ├── package.json
│   ├── .env                 # API key config (edit this!)
│   └── .env.example
├── client/                  # React + Vite Frontend
│   ├── index.html
│   ├── vite.config.js       # Proxies /api to Express
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── package.json
│   └── src/
│       ├── main.jsx
│       ├── App.jsx           # Router setup
│       ├── index.css         # Global styles + Tailwind
│       ├── context/
│       │   └── AuthContext.jsx
│       ├── components/
│       │   └── ProtectedRoute.jsx
│       ├── pages/
│       │   ├── Login.jsx
│       │   └── ChatApp.jsx
│       └── utils/
│           └── api.js
├── setup.bat                # One-click dependency install
└── start.bat                # One-click server launcher
```

## Quick Start

### 1. Configure API Key
Edit `server/.env` and replace the placeholder with your actual key:
```
ANTHROPIC_API_KEY=sk-ant-...your-key-here...
SYSTEM_PROMPT="You are a helpful, concise assistant."
PORT=3001
DOCUMENT_ROOT=D:/YourFolder
```

`DOCUMENT_ROOTS` should point to one or more local folders you want Claude to read from on your machine. Separate multiple paths with commas. The server scans text-based files and PDFs in each folder and in their subfolders, then includes the most relevant snippets in chat requests.

If your PDFs are scanned images, run [ocr_full_dd.py](ocr_full_dd.py) once to generate `.ocr.txt` files next to each PDF. The server can read those text files directly, so scanned PDFs become available to Claude.

### 2. Install Dependencies
**Option A — Use the batch script:**
```
Double-click setup.bat
```

**Option B — Manual install:**
```bash
# Terminal 1: Install server
cd server
npm install

# Terminal 2: Install client
cd client
npm install
```

### 3. Start the Application
**Option A — Use the batch script:**
```
Double-click start.bat
```

**Option B — Manual start:**
```bash
# Terminal 1: Start Express server
cd server
npm start

# Terminal 2: Start Vite dev server
cd client
npm run dev
```

### 4. Open the App
Navigate to **http://localhost:5173** in your browser.

## Features

- **🔐 Authentication** — Login page with protected routing
- **💬 Real-time Chat** — Full conversation history with Claude 3.5 Sonnet
- **🎨 Enterprise UI** — Glassmorphism design, custom color palette, micro-animations
- **📱 Responsive** — Works on desktop and mobile
- **⚡ Fast** — Vite dev server with HMR, API proxying
- **🛡️ Secure** — API key stays server-side, CORS configured

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, Vite, Tailwind CSS, React Router |
| Backend | Node.js, Express, Anthropic SDK |
| AI Model | Claude 3.5 Sonnet |
