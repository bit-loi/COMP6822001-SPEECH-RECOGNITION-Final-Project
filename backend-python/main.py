import os
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import voice, agent, projects, github_router
from dependencies.auth import verify_user
from fastapi import Depends
app = FastAPI(
    title="AmbatuCode API",
    description="Voice-to-code and AI Agent with memory for developers recovering from hand injuries",
    version="2.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:3001"], # Add other origins as needed
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers securely (except public like /health)
app.include_router(voice.router, dependencies=[Depends(verify_user)])
app.include_router(agent.router, dependencies=[Depends(verify_user)])
app.include_router(projects.router)
app.include_router(github_router.router)

@app.get("/")
async def root():
    return {
        "message": "AmbatuCode API",
        "features": ["voice-to-code", "ai-agent-with-memory"],
        "gemini_model": "gemini-2.0-flash-exp"
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
