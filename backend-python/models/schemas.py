from pydantic import BaseModel, Field
from typing import Optional, List, Literal, Dict, Any
from datetime import datetime

# --- Voice-to-Code Models ---

class VoiceTranscript(BaseModel):
    transcript: str = Field(..., description="Raw speech transcript from Web Speech API")
    confidence: float = Field(0.0, ge=0.0, le=1.0, description="Speech recognition confidence")
    language: str = Field("en-US", description="Language code")

class EditorContext(BaseModel):
    filename: Optional[str] = None
    file_language: Optional[str] = "javascript"
    cursor_line: int = Field(1, ge=1)
    cursor_column: int = Field(1, ge=1)
    selected_text: Optional[str] = None
    surrounding_code: Optional[str] = None  # Code around cursor for context

class VoiceIntent(BaseModel):
    type: Literal["generate", "modify", "navigate", "explain", "chat"]
    action: str
    target_scope: Literal["cursor", "selection", "file", "project"] = "cursor"
    target_line: Optional[int] = None
    language: str = "javascript"
    needs_context: bool = False

class CodeResult(BaseModel):
    code: str
    imports: List[str] = []
    explanation: str
    intent: VoiceIntent

class VoiceToCodeRequest(BaseModel):
    transcript: VoiceTranscript
    editor_context: EditorContext
    user_id: str
    session_id: str
    ui_language: Optional[str] = "en"

class VoiceToCodeResponse(BaseModel):
    success: bool
    result: Optional[CodeResult] = None
    error: Optional[str] = None
    processing_time_ms: float

# --- Agent & Memory Models ---

class Message(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str
    timestamp: datetime = Field(default_factory=datetime.now)

class EmbeddedMessage(Message):
    embedding: Optional[List[float]] = None
    id: Optional[str] = None

class UserProfile(BaseModel):
    user_id: str
    cognitive_needs: List[str] = []
    preferred_chunk_size: Literal["micro", "small", "medium", "large"] = "small"
    needs_frequent_feedback: bool = False
    break_reminder_interval: int = 45
    preferences: Dict[str, Any] = {}

class MemoryInsight(BaseModel):
    id: Optional[str] = None
    user_id: str
    category: Literal["coding_pattern", "preference", "project_context", "cognitive_need"]
    title: str
    content: str
    importance_score: float = 0.5
    access_count: int = 0

class ChatRequest(BaseModel):
    user_id: str
    session_id: str
    message: str
    editor_context: Optional[EditorContext] = None # Using the typed EditorContext
    ui_language: Optional[str] = "en"

class ChatResponse(BaseModel):
    message: str
    actions: List[Dict[str, Any]] = []        # Client-side actions (create_file, insert_code, etc.)
    server_results: List[Dict[str, Any]] = []  # Results of server-side tool calls (git, terminal)
    relevant_memories: List[Dict[str, Any]] = []
    processing_time_ms: float
