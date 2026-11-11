from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from typing import AsyncGenerator
from pydantic import BaseModel
import time
import json

# NOTE: speech-to-text no longer lives in this router. Voice input is
# recognised locally by a classical (non-deep-learning) keyword pipeline and
# uses no cloud API. This router only handles text-based requests (a
# transcript string in, code/intent out).

from models.schemas import (
    VoiceToCodeRequest,
    VoiceToCodeResponse,
    CodeResult,
    VoiceIntent
)
from services.gemini_service import GeminiService
from services.voice_processor import VoiceProcessor

router = APIRouter(prefix="/api/voice", tags=["voice"])

# Initialize services
gemini_service = GeminiService()
voice_processor = VoiceProcessor()

@router.post("/process", response_model=VoiceToCodeResponse)
async def process_voice_command(request: VoiceToCodeRequest):
    """
    Process voice transcript and generate code
    
    Flow:
    1. Clean transcript
    2. Classify intent
    3. Generate/modify code based on intent
    4. Return result
    """
    
    start_time = time.time()
    
    try:
        # 1. Clean transcript
        cleaned_transcript = voice_processor.clean_transcript(
            request.transcript.transcript
        )
        
        # 2. Classify intent
        intent = await gemini_service.classify_intent(
            cleaned_transcript,
            request.editor_context
        )
        
        # 3. Execute based on intent
        result = None
        
        if intent.type == "generate":
            result = await gemini_service.generate_code(
                intent,
                request.editor_context
            )
        
        elif intent.type == "modify":
            if not request.editor_context.selected_text:
                raise HTTPException(
                    status_code=400,
                    detail="No code selected for modification"
                )
            
            result = await gemini_service.modify_code(
                intent,
                request.editor_context.selected_text,
                request.editor_context.file_language or "javascript"
            )
        
        elif intent.type == "explain":
            code_to_explain = (
                request.editor_context.selected_text 
                or request.editor_context.surrounding_code
            )
            
            if not code_to_explain:
                raise HTTPException(
                    status_code=400,
                    detail="No code to explain"
                )
            
            explanation = await gemini_service.explain_code(
                code_to_explain,
                request.editor_context.file_language or "javascript",
                user_cognitive_needs=[]  # Get from user profile later
            )
            
            result = CodeResult(
                code="",
                explanation=explanation,
                intent=intent
            )
        
        elif intent.type == "chat":
            # Handle as general chat (future: integrate with memory)
            result = CodeResult(
                code="",
                explanation="This is a general question. I'll help you with that.",
                intent=intent
            )
        
        else:
            # Fallback for navigate or others if not explicitly handled yet
             result = CodeResult(
                code="",
                explanation=f"Intent '{intent.type}' recognized: {intent.action}",
                intent=intent
            )
        
        processing_time = (time.time() - start_time) * 1000
        
        return VoiceToCodeResponse(
            success=True,
            result=result,
            processing_time_ms=processing_time
        )
    
    except Exception as e:
        processing_time = (time.time() - start_time) * 1000
        return VoiceToCodeResponse(
            success=False,
            error=str(e),
            processing_time_ms=processing_time
        )

@router.post("/process-stream")
async def process_voice_command_stream(request: VoiceToCodeRequest):
    """
    Stream code generation progress (for longer operations)
    Returns Server-Sent Events
    """
    
    async def generate_events() -> AsyncGenerator[str, None]:
        try:
            # Send processing start event
            yield f"data: {json.dumps({'event': 'start'})}\n\n"
            
            # Clean transcript
            cleaned = voice_processor.clean_transcript(request.transcript.transcript)
            yield f"data: {json.dumps({'event': 'cleaned', 'transcript': cleaned})}\n\n"
            
            # Classify intent
            intent = await gemini_service.classify_intent(cleaned, request.editor_context)
            yield f"data: {json.dumps({'event': 'intent', 'data': intent.dict()})}\n\n"
            
            # Generate code
            if intent.type == "generate":
                result = await gemini_service.generate_code(intent, request.editor_context)
                yield f"data: {json.dumps({'event': 'result', 'data': result.dict()})}\n\n"
            elif intent.type == "modify":
                 result = await gemini_service.modify_code(
                    intent, 
                    request.editor_context.selected_text or "",
                    request.editor_context.file_language or "javascript"
                )
                 yield f"data: {json.dumps({'event': 'result', 'data': result.dict()})}\n\n"
            
            # Done
            yield f"data: {json.dumps({'event': 'done'})}\n\n"
            
        except Exception as e:
            yield f"data: {json.dumps({'event': 'error', 'message': str(e)})}\n\n"
    
    return StreamingResponse(
        generate_events(),
        media_type="text/event-stream"
    )


# --- Supported Languages Configuration ---
SUPPORTED_PROGRAMMING_LANGUAGES = [
    # Core Web & Mobile
    "javascript", "typescript", "html", "css", "react", "vue", "angular", "node",
    "swift", "kotlin", "dart", "flutter", "react-native", 
    # System & Backend
    "python", "go", "rust", "java", "cpp", "c", "csharp", "php", "ruby", "perl",
    "clojure", "haskell", "elixir", "erlang", "lua", "scala", "groovy",
    # Data & Database
    "sql", "plsql", "r", "matlab", "julia", "sas", "vba",
    # Infrastructure & Shell
    "shell", "powershell", "bash", "yaml", "json", "toml", "dockerfile", "makefile", 
    "nginx", "apache", "terraform", "hcl",
    # Niche & Legacy
    "solidity", "zig", "fortran", "cobol", "abap", "prolog", "lisp", "scheme", "ocaml"
]

SUPPORTED_UI_LANGUAGES = {
    # Most Common
    "en": "English",
    "id": "Indonesian",
    "es": "Spanish",
    "ja": "Japanese",
    "fr": "French",
    "de": "German",
    "zh": "Chinese (Simplified)",
    "ko": "Korean",
    "pt": "Portuguese",
    "ru": "Russian",
    "it": "Italian",
    "ar": "Arabic",
    # Others
    "nl": "Dutch",
    "tr": "Turkish",
    "vi": "Vietnamese",
    "th": "Thai",
    "hi": "Hindi",
    "ms": "Malay",
    "pt-br": "Portuguese (Brazil)",
    "zh-tw": "Chinese (Traditional)"
}

class EnhanceTranscriptRequest(BaseModel):
    transcript: str
    file_language: str = "python"
    surrounding_code: str = ""
    ui_language: str = "en"
    # Optional: can add more metadata here if needed
    
    class Config:
        schema_extra = {
            "example": {
                "transcript": "buat fungsi login",
                "file_language": "javascript",
                "ui_language": "id"
            }
        }


@router.post("/enhance-transcript")
async def enhance_voice_transcript(request: EnhanceTranscriptRequest):
    """
    AI-enhanced voice transcript processing:
    1. Cleans up speech recognition errors
    2. Detects intent type (generate/modify/explain/chat)
    3. Returns suggested action label and cleaned text
    """
    try:
        result = await gemini_service.enhance_voice_transcript(
            raw_transcript=request.transcript,
            file_language=request.file_language,
            surrounding_code=request.surrounding_code,
            ui_language=request.ui_language
        )
        return {"success": True, **result}
    except Exception as e:
        return {
            "success": False,
            "cleaned_transcript": request.transcript,
            "intent_type": "chat",
            "intent_label": "Chat",
            "confidence": 0.5,
            "suggested_action": request.transcript,
            "error": str(e)
        }
