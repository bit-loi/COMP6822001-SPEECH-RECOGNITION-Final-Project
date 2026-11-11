from fastapi import APIRouter, HTTPException
from models.schemas import ChatRequest, ChatResponse, Message, UserProfile
from services.memory_service import MemoryService
from services.gemini_service import GeminiService
from services.supabase_service import SupabaseService
from services.agent_executor import AgentExecutor
import time

router = APIRouter(prefix="/api/agent", tags=["agent"])

# Initialize services
memory_service = MemoryService()
gemini_service = GeminiService()
supabase_service = SupabaseService()
agent_executor = AgentExecutor()

@router.post("/chat", response_model=ChatResponse)
async def chat_with_agent(request: ChatRequest):
    """
    Chat with AI Agent (with memory + real automation tools)

    Flow:
    1. Store user message in memory
    2. Retrieve relevant context (RAG)
    3. Run AgentExecutor with Gemini Function Calling
    4. Execute server-side tools (git, terminal)
    5. Return response + client-side actions for frontend
    """

    start_time = time.time()

    try:
        # 1. Store user message
        user_message = Message(role="user", content=request.message)
        await memory_service.add_message(
            user_id=request.user_id,
            session_id=request.session_id,
            message=user_message
        )

        # 2. Build context from memory (RAG)
        context = await memory_service.get_relevant_context(
            user_id=request.user_id,
            session_id=request.session_id,
            query=request.message
        )

        # 3. Get user profile
        try:
            profile = await supabase_service.get_user_profile(request.user_id)
        except Exception:
            profile = None

        if not profile:
            default_profile = UserProfile(user_id=request.user_id)
            try:
                await supabase_service.upsert_user_profile(default_profile)
            except Exception:
                pass
            profile = default_profile.dict()

        # 4. Run the agentic executor (with Function Calling)
        editor_ctx = request.editor_context.dict() if request.editor_context else None
        result = await agent_executor.run(
            message=request.message,
            context=context,
            user_profile=profile,
            editor_context=editor_ctx,
            ui_language=request.ui_language
        )

        # 5. Store assistant response
        assistant_message = Message(role="assistant", content=result["message"])
        await memory_service.add_message(
            user_id=request.user_id,
            session_id=request.session_id,
            message=assistant_message
        )

        processing_time = (time.time() - start_time) * 1000

        return ChatResponse(
            message=result["message"],
            actions=result.get("actions", []),
            server_results=result.get("server_results", []),
            relevant_memories=[],
            processing_time_ms=processing_time
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/profile")
async def update_user_profile(profile: UserProfile):
    """Update user's cognitive profile"""
    
    result = await supabase_service.upsert_user_profile(profile)
    return {"success": True, "profile": result}

@router.get("/profile/{user_id}")
async def get_user_profile(user_id: str):
    """Get user's cognitive profile"""
    
    profile = await supabase_service.get_user_profile(user_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    return profile
