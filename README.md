# 🤖 Gemini Nexus - Fullstack AI Chatbot with Supabase

A modern, responsive conversational AI application built with **Google Gemini** and **Supabase**, featuring a **strict architectural separation between Frontend, Backend, and Database tiers**.

---

## 🏛️ Architecture: Frontend vs. Backend vs. Supabase

```
┌─────────────────────────────────┐        HTTP / SSE         ┌─────────────────────────────────┐       HTTPS / REST       ┌────────────────────────┐
│         FRONTEND CLIENT         │ ◄───────────────────────► │         BACKEND SERVER          │ ◄──────────────────────► │   GOOGLE GEMINI API    │
│  (Browser: HTML5 / CSS3 / JS)   │   POST /api/chat/stream   │    (Node.js / Express Server)   │     @google/genai SDK    │     (Google Cloud)     │
└───────────────┬─────────────────┘                           └────────────────┬────────────────┘                          └────────────────────────┘
                │                                                              │
                │ Supabase JS (Anon Key + RLS)                                 │ Supabase JS (Service Role / Admin)
                ▼                                                              ▼
        ┌─────────────────────────────────────────────────────────────────────────────┐
        │                              SUPABASE DATABASE                              │
        │                        (PostgreSQL: chats & messages)                       │
        └─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔐 Environment Variables: Frontend vs. Backend Comparison

A separate `.env` file exists in **both** `frontend/` and `backend/`. This differentiation guarantees that sensitive admin credentials never leak to the public browser.

### 1. `backend/.env` (Server Privileged Secrets)
Located in [`backend/.env`](file:///c:/Users/KOVELA%20SAI/OneDrive/Desktop/New%20folder/backend/.env):

| Variable | Description | Example / Source |
| :--- | :--- | :--- |
| `PORT` | Local server port for Express | `5000` |
| `GEMINI_API_KEY` | Private Google Gemini LLM API Key | [Google AI Studio](https://aistudio.google.com/app/apikey) |
| `DEFAULT_MODEL` | Default Gemini model ID | `gemini-2.5-flash` |
| `SUPABASE_URL` | Supabase Project REST Endpoint URL | `https://xyzcompany.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase Public Anonymous API Key | Supabase > Project Settings > API |
| `SUPABASE_SERVICE_ROLE_KEY` | **Admin/Secret** Key to bypass RLS for server operations | Supabase > Project Settings > API |

> [!CAUTION]
> **NEVER** expose `GEMINI_API_KEY` or `SUPABASE_SERVICE_ROLE_KEY` to the browser or frontend bundle! They belong exclusively in `backend/.env`.

---

### 2. `frontend/.env` (Client Public Configuration)
Located in [`frontend/.env`](file:///c:/Users/KOVELA%20SAI/OneDrive/Desktop/New%20folder/frontend/.env):

| Variable | Description | Safety Note |
| :--- | :--- | :--- |
| `SUPABASE_URL` | Supabase Project URL | Publicly accessible in browser |
| `SUPABASE_ANON_KEY` | Supabase Anon Key | **Safe for browser**; protected by Row Level Security (RLS) |
| `BACKEND_API_URL` | Base URL of the backend API | `http://localhost:5000` |

---

## ⚡ Database Setup: Supabase SQL Schema

To persist conversations and messages in Supabase:
1. Open your [Supabase Dashboard](https://supabase.com/dashboard).
2. Go to **SQL Editor**.
3. Copy and run the SQL code from [`supabase_schema.sql`](file:///c:/Users/KOVELA%20SAI/OneDrive/Desktop/New%20folder/supabase_schema.sql):
   - Creates `chats` table (`id`, `title`, `model`, `created_at`, `updated_at`).
   - Creates `messages` table (`id`, `chat_id`, `role`, `content`, `created_at`).
   - Configures Row Level Security (RLS) policies for anonymous and authenticated access.

---

## 🚀 Quick Start Guide

### 1. Start the Application
Double-click [`start.bat`](file:///c:/Users/KOVELA%20SAI/OneDrive/Desktop/New%20folder/start.bat) or run:
```powershell
npm start
```
Open **[http://localhost:5000](http://localhost:5000)** in your browser.

### 2. Enter Your Credentials
- **Gemini Key**: Paste into `backend/.env` under `GEMINI_API_KEY` or enter it directly in the web UI Settings.
- **Supabase**: Paste your URL and keys into `frontend/.env` and `backend/.env`, or enter them in the web UI Settings and click **Test Supabase**.

---

## 📂 Project Structure

```
.
├── backend/
│   ├── routes/
│   │   ├── chat.js              # Chat endpoints with Supabase persistence
│   │   └── health.js            # Health check, /env.js dynamic loader, and key testing
│   ├── services/
│   │   ├── geminiService.js     # Google Gen AI SDK client & streaming
│   │   └── supabaseService.js   # Backend Supabase client for database operations
│   ├── config.js                # Central environment configuration
│   ├── server.js                # Express app entry point
│   ├── .env                     # Private server credentials (Gemini key, Service Role key)
│   ├── .env.example             # Backend template
│   └── package.json             # Backend dependencies (@google/genai, @supabase/supabase-js)
├── frontend/
│   ├── css/
│   │   └── style.css            # Dark mode, glassmorphism, responsive styles
│   ├── js/
│   │   ├── api.js               # Frontend API client
│   │   ├── supabaseClient.js    # Frontend Supabase client (Anon key + RLS)
│   │   ├── markdown.js          # Markdown parser with code syntax highlighting & copy
│   │   └── app.js               # UI controller, SSE stream reader, and session state
│   ├── index.html               # Single-page interface with Architecture & Settings modals
│   ├── .env                     # Public client configuration (Supabase URL & Anon Key)
│   └── .env.example             # Frontend template
├── supabase_schema.sql          # Ready-to-run Supabase SQL table definitions & RLS policies
├── package.json                 # Root script runner
├── start.bat                    # Windows 1-click launcher
├── start.ps1                    # PowerShell launcher
└── README.md                    # Full documentation
```
