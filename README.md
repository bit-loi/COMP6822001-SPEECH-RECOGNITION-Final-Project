# Neuravity 🧠🚀

**A neurodivergent-friendly AI-powered code editor web application.** Designed from the ground up to reduce barriers for developers with ADHD, Autism, Dyslexia, and other neurodivergent conditions by blending deep AI automation with high sensory customizability.

---

## 🌩️ Core Problems Solved

Traditional code editors create barriers for neurodivergent developers:
- **ADHD**: Context switching, time blindness, executive dysfunction, cognitive overload from complex menus.
- **Autism**: Sensory overload, need for predictability, struggling with ambiguous unstructured error messages.
- **Dyslexia**: Reading dense code, syntax confusion, overwhelming file layouts.

Neuravity solves this with **Voice-to-Code Automation**, **Cognitive Needs Customization**, and a **Proactive AI Agent** that handles the boring, overwhelming stuff for you.

---

## 🌟 Key Features

### 1. 🤖 True AI Automation Agent (New!)
Unlike typical chat bots, the Neuravity AI acts directly on your workspace. Tell it what you want, and it will:
- **`create_file` & `delete_file`**: Auto-create or remove files in your project.
- **`create_folder` & `delete_folder`**: Instantly generate or remove directories.
- **`insert_code`**: Append code directly to your active text editor.
- **`update_file`**: Perform full code refactoring on your target.
- **`run_command`**: Execute bash commands securely in the integrated terminal (e.g., `npm install`).
- **`git_commit_push`**: Automatically stage changes, generate a conventional commit message, and push to GitHub!

### 2. 🎙️ Voice-to-Code Contextual Commands
Don't want to type? Speak it. 
- Integrated Voice STT (Speech-to-Text) powered by a custom Python backend (using `ffmpeg` & Gemini Flash).
- The AI automatically translates raw intent ("bikin fungsi hello world") into actual cursor modifications.

### 3. 🛡️ Neurodivergent Customizations Panel
One-click settings tailored for specific needs:
- **Dyslexia Mode**: Bigger line heights, custom spacing, OpenDyslexic-styled fonts.
- **ADHD / Focus Mode**: Instantly hides all distractions (sidebars, terminal, chat) through `F11`.
- **Sensory Settings**: Disable overly flashy animations, pick comfortable high-contrast themes.

### 4. 🧠 Adaptive Memory System
- **Conversation Memory**: The AI remembers context from previous sessions.
- **User Profile Memory**: The AI learns your cognitive preferences (e.g., "explain step-by-step for ADHD") and automatically adjusts its language and tone.
- **Multilingual Native**: Speak/type in English, Indonesian, Spanish, or Japanese, and the AI matches your language perfectly.

### 5. 📥 One-Click Therapy Sharing & Exporting
- Export your coding conversation into a beautifully formatted Markdown/PDF transcript.
- Zip and download your entire project workspace locally.
- Perfect for sharing context, struggles, and achievements with therapists or coaches.

---

## 🛠️ Tech Stack

- **Frontend**: Next.js 14 App Router, TypeScript, Tailwind CSS, Monaco Editor, Zustand.
- **Backend (Python)**: FastAPI, Uvicorn, Python-based Agentic Tool Executors.
- **Backend (Go)**: Go Fiber (for fast socket routing and microservices).
- **AI Core**: Google Gemini 2.5 Flash API (Function Calling & Embedding).
- **Database**: PostgreSQL / Supabase.
- **Integrations**: GitHub OAuth, JSZip.

---

## 🚀 Installation & Setup

### Prerequisites
- Node.js 20+
- Python 3.10+
- Go 1.21+
- FFmpeg (for voice processing via backend)
- Google Gemini API Key

### Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Neuravity
   ```

2. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   cp .env.example .env.local
   # Edit .env.local and add NEXT_PUBLIC_GEMINI_API_KEY
   npm run dev
   ```

3. **Python AI Agent Backend Setup**
   ```bash
   cd backend-python
   python -m venv venv
   source venv/Scripts/activate  # Or `venv\Scripts\activate` on Windows
   pip install -r requirements.txt
   uvicorn main:app --host 0.0.0.0 --port 8000
   ```

4. **Go Microservice Backend Setup**
   ```bash
   cd backend-go
   go mod tidy
   go run main.go
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

---

## ❤️ Contributing & Community

We warmly welcome contributions! Our goal is to make the coding landscape inclusive for **all** neurotypes. 

If you are a neurodivergent coder and find something overwhelming, **open an issue**. If you have an idea for a feature that would help you, **open a PR**.

### License
MIT License.

---
_Neuravity — Code the way your brain works best._
