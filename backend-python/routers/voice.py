from fastapi import APIRouter, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from typing import AsyncGenerator
from pydantic import BaseModel
import speech_recognition as sr
import io
import os
import time
import json
import asyncio

# Point pydub to local ffmpeg.exe (doesn't need system-wide installation)
try:
    from pydub import AudioSegment
    _backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    _local_ffmpeg = os.path.join(_backend_dir, "ffmpeg.exe")
    _local_ffprobe = os.path.join(_backend_dir, "ffprobe.exe")
    if os.path.exists(_local_ffmpeg):
        AudioSegment.converter = _local_ffmpeg
        print(f"[Voice] Using local ffmpeg: {_local_ffmpeg}")
    if os.path.exists(_local_ffprobe):
        AudioSegment.ffprobe = _local_ffprobe
        print(f"[Voice] Using local ffprobe: {_local_ffprobe}")
    elif not os.path.exists(_local_ffmpeg):
        print("[Voice] ffmpeg.exe not found locally, pydub will use system PATH")
except ImportError:
    pass


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


@router.post("/transcribe-audio")
async def transcribe_audio(audio: UploadFile):
    """
    Transcribe audio using Gemini's multimodal API.
    Accepts audio/webm, audio/ogg, audio/wav, audio/mp4 from MediaRecorder.
    No dependency on Chrome's Web Speech API or Google Speech servers.
    """
    try:
        audio_bytes = await audio.read()
        mime_type = audio.content_type or "audio/webm"

        transcript = await gemini_service.transcribe_audio(
            audio_bytes=audio_bytes,
            mime_type=mime_type
        )
        return {"success": True, "transcript": transcript}
    except Exception as e:
        return {"success": False, "transcript": "", "error": str(e)}


# ─── Primary STT Endpoint using SpeechRecognition ──────────────────────────

recognizer = sr.Recognizer()


def _do_transcribe(audio_bytes: bytes, content_type: str, language: str = "en-US") -> str:
    """
    Synchronous transcription using speech_recognition.
    Converts audio bytes → WAV via pydub → recognize_google().
    Must run in a thread (blocking I/O).
    """
    try:
        from pydub import AudioSegment
        # Determine format for pydub
        fmt = "webm"
        if "ogg" in content_type:
            fmt = "ogg"
        elif "wav" in content_type:
            fmt = "wav"
        elif "mp4" in content_type or "m4a" in content_type:
            fmt = "mp4"

        # Convert to WAV in memory
        audio_segment = AudioSegment.from_file(io.BytesIO(audio_bytes), format=fmt)
        # Ensure 16kHz mono for best recognition results
        audio_segment = audio_segment.set_channels(1).set_frame_rate(16000)
        wav_io = io.BytesIO()
        audio_segment.export(wav_io, format="wav")
        wav_io.seek(0)

    except Exception as conv_err:
        raise Exception(f"Audio conversion failed (ffmpeg required): {conv_err}")

    # Transcribe using Google Speech Recognition
    with sr.AudioFile(wav_io) as source:
        # Read the entire audio file
        audio_data = recognizer.record(source)

    try:
        # Use provided language, default to en-US but Gemini handles multi-lang better
        text = recognizer.recognize_google(audio_data, language=language)
        return text
    except sr.UnknownValueError:
        return ""  # Could not understand audio
    except sr.RequestError as e:
        raise Exception(f"Google Speech API error: {e}")


@router.post("/stt")
async def speech_to_text(audio: UploadFile, language: str = "en-US"):
    """
    Primary Speech-to-Text endpoint.
    Uses Python's speech_recognition library with Google Speech API.
    
    Flow:
    1. Receive audio blob from browser MediaRecorder
    2. Convert to WAV via pydub (requires ffmpeg)
    3. Transcribe with sr.recognize_google()
    4. Return transcript text
    """
    try:
        audio_bytes = await audio.read()
        content_type = audio.content_type or "audio/webm"

        # Use Gemini's multimodal power to transcribe directly from raw bytes
        # This avoids the dependency on local ffmpeg and improves accuracy
        transcript = await gemini_service.transcribe_audio(
            audio_bytes=audio_bytes,
            mime_type=content_type
        )

        return {"success": True, "transcript": transcript}

    except Exception as e:
        return {"success": False, "transcript": "", "error": str(e)}

# Trigger reload
