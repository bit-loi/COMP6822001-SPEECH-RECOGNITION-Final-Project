import google.generativeai as genai
import os
import json
import asyncio
from typing import Optional, Dict, Any, List
from models.schemas import VoiceIntent, EditorContext, CodeResult

class GeminiService:
    def __init__(self):
        genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
        
        # Use Gemini 2.5 Flash — fastest and most capable flash model available
        self.model = genai.GenerativeModel(
            model_name="gemini-2.0-flash",
            generation_config={
                "temperature": 0.2,  # Low for consistent code generation
                "top_p": 0.95,
                "top_k": 40,
                "max_output_tokens": 4096,
            }
        )

    # --- VOICE Features ---
    
    async def classify_intent(
        self, 
        transcript: str, 
        editor_context: EditorContext
    ) -> VoiceIntent:
        """Classify user's voice intent using Gemini"""
        
        prompt = f"""You are a voice-to-code interpreter for developers.

User said: "{transcript}"

Editor Context:
- File: {editor_context.filename or 'untitled'}
- Language: {editor_context.file_language}
- Cursor at: Line {editor_context.cursor_line}, Column {editor_context.cursor_column}
- Selected text: {editor_context.selected_text or 'none'}

Classify the intent and return ONLY valid JSON (no markdown, no extra text):
{{
  "type": "generate" | "modify" | "navigate" | "explain" | "chat",
  "action": "specific action description",
  "target_scope": "cursor" | "selection" | "file",
  "target_line": null or line number,
  "language": "{editor_context.file_language}",
  "needs_context": true or false
}}

Intent Types:
- "generate": Create new code ("write a function to...", "create a class...")
- "modify": Change existing code ("refactor this", "add error handling")
- "navigate": Move cursor ("go to line 42", "find function login")
- "explain": Explain code ("what does this do", "explain this function")
- "chat": General question ("how do I...", "what's the best way to...")

Examples:

Input: "write a function to reverse a string"
Output: {{"type": "generate", "action": "create string reversal function", "target_scope": "cursor", "language": "javascript", "needs_context": false}}

Input: "explain this" (with code selected)
Output: {{"type": "explain", "action": "explain selected code", "target_scope": "selection", "needs_context": true}}

Input: "add error handling" (cursor in function)
Output: {{"type": "modify", "action": "add error handling", "target_scope": "cursor", "language": "javascript", "needs_context": true}}

Return ONLY the JSON object.
"""
        
        try:
            response = await asyncio.to_thread(
                self.model.generate_content, prompt
            )
            
            # Extract JSON from response
            text = response.text.strip()
            
            # Remove markdown code blocks if present
            if text.startswith("```"):
                text = text.split("```")[1]
                if text.startswith("json"):
                    text = text[4:]
            
            intent_data = json.loads(text.strip())
            
            return VoiceIntent(**intent_data)
            
        except Exception as e:
            # Fallback to keyword-based classification
            return self._fallback_intent_classification(transcript, editor_context)
    
    def _fallback_intent_classification(
        self, 
        transcript: str, 
        editor_context: EditorContext
    ) -> VoiceIntent:
        """Simple keyword-based fallback"""
        lower = transcript.lower()
        
        # Detect intent from keywords
        if any(word in lower for word in ["write", "create", "generate", "make"]):
            return VoiceIntent(
                type="generate",
                action=transcript,
                language=editor_context.file_language
            )
        elif any(word in lower for word in ["explain", "what does", "what is"]):
            return VoiceIntent(
                type="explain",
                action=transcript,
                target_scope="selection" if editor_context.selected_text else "cursor"
            )
        elif any(word in lower for word in ["refactor", "modify", "change", "add"]):
            return VoiceIntent(
                type="modify",
                action=transcript,
                target_scope="selection" if editor_context.selected_text else "cursor",
                language=editor_context.file_language
            )
        else:
            return VoiceIntent(
                type="chat",
                action=transcript,
                language=editor_context.file_language
            )
    
    async def generate_code(
        self, 
        intent: VoiceIntent, 
        editor_context: EditorContext
    ) -> CodeResult:
        """Generate code based on intent"""
        
        prompt = f"""Generate {intent.language} code for: {intent.action}

Context:
- File: {editor_context.filename or 'new file'}
- Insert at: Line {editor_context.cursor_line}
- Current language: {intent.language}

Surrounding code for context:
```{intent.language}
{editor_context.surrounding_code or '// Empty file'}
```

Requirements:
1. Generate ONLY the code, no explanations outside the JSON
2. Match existing code style and indentation
3. Use modern best practices for {intent.language}
4. Include necessary imports if needed
5. Add brief inline comments for clarity
6. Make code production-ready

Return ONLY this JSON format (no markdown):
{{
  "code": "the generated code here",
  "imports": ["import statements if needed"],
  "explanation": "one clear sentence explaining what this code does"
}}
"""
        
        try:
            response = await asyncio.to_thread(
                self.model.generate_content, prompt
            )
            
            text = response.text.strip()
            
            # Clean markdown if present
            if text.startswith("```"):
                text = text.split("```")[1]
                if text.startswith("json"):
                    text = text[4:]
            
            result_data = json.loads(text.strip())
            
            return CodeResult(
                code=result_data["code"],
                imports=result_data.get("imports", []),
                explanation=result_data["explanation"],
                intent=intent
            )
            
        except Exception as e:
            raise Exception(f"Code generation failed: {str(e)}")
    
    async def modify_code(
        self, 
        intent: VoiceIntent, 
        selected_code: str, 
        language: str
    ) -> CodeResult:
        """Modify existing code based on intent"""
        
        prompt = f"""Modify this {language} code: {intent.action}

Original code:
```{language}
{selected_code}
```

Requirements:
1. Return ONLY the modified code
2. Preserve functionality unless explicitly changing it
3. Maintain the existing code style
4. Explain changes briefly

Return ONLY this JSON (no markdown):
{{
  "code": "modified code here",
  "imports": ["any new imports needed"],
  "explanation": "brief summary of changes made"
}}
"""
        
        try:
            response = await asyncio.to_thread(
                self.model.generate_content, prompt
            )
            
            text = response.text.strip()
            if text.startswith("```"):
                text = text.split("```")[1]
                if text.startswith("json"):
                    text = text[4:]
            
            result_data = json.loads(text.strip())
            
            return CodeResult(
                code=result_data["code"],
                imports=result_data.get("imports", []),
                explanation=result_data["explanation"],
                intent=intent
            )
            
        except Exception as e:
            raise Exception(f"Code modification failed: {str(e)}")
    
    async def explain_code(
        self, 
        code: str, 
        language: str,
        user_cognitive_needs: List[str] = []
    ) -> str:
        """Explain code in a plain, low-effort way"""
        
        # Adapt explanation style based on cognitive needs
        style_instructions = ""
        if "dyslexia" in user_cognitive_needs:
            style_instructions = "Use simple words, short sentences, avoid jargon."
        elif "adhd" in user_cognitive_needs:
            style_instructions = "Be concise, use bullet points, highlight key concepts."
        elif "autism" in user_cognitive_needs:
            style_instructions = "Be explicit and literal, provide step-by-step breakdown."
        else:
            style_instructions = "Explain clearly and thoroughly."
        
        prompt = f"""Explain this {language} code:
```{language}
{code}
```

{style_instructions}

Provide:
1. What the code does (1-2 sentences)
2. How it works (step-by-step)
3. Any important details or gotchas

Keep explanation clear and helpful.
"""
        
        response = await asyncio.to_thread(
            self.model.generate_content, prompt
        )
        
        return response.text.strip()

    # --- MEMORY Features ---
    
    async def generate_embedding(self, text: str) -> List[float]:
        """Generate embedding for text using Gemini embedding model"""
        result = await asyncio.to_thread(
            genai.embed_content,
            model="models/gemini-embedding-001",
            content=text
        )
        return result['embedding']

    async def enhance_voice_transcript(
        self,
        raw_transcript: str,
        file_language: str = "python",
        surrounding_code: str = "",
        ui_language: str = "en"
    ) -> dict:
        """Use AI to enhance/correct voice transcript and detect intent"""

        prompt = f"""You are an AI assistant that helps developers using voice-to-code.

A user said (via speech recognition): "{raw_transcript}"

Current file language: {file_language}
Surrounding code context:
```{file_language}
{surrounding_code or '(empty file)'}
```

Your tasks:
1. Clean up the transcript (fix speech recognition errors, normalize technical terms)
2. Detect the intent type
3. Provide a clean, actionable version of the request in the {ui_language} language.

Return ONLY this JSON (no markdown, no extra text):
{{
  "cleaned_transcript": "corrected and clarified version of what the user said",
  "intent_type": "generate" | "modify" | "explain" | "chat" | "navigate",
  "intent_label": "Short label (in {ui_language}) like 'Generate Function' or 'Fix Bug'",
  "confidence": 0.0-1.0,
  "suggested_action": "Brief description (in {ui_language}) of what will happen"
}}

Strictly adhere to the {ui_language} language for all text fields.
"""

        try:
            response = await asyncio.to_thread(
                self.model.generate_content, prompt
            )
            text = response.text.strip()
            if text.startswith("```"):
                text = text.split("```")[1]
                if text.startswith("json"):
                    text = text[4:]
            return json.loads(text.strip())
        except Exception as e:
            # Fallback: return raw transcript with basic intent
            return {
                "cleaned_transcript": raw_transcript,
                "intent_type": "chat",
                "intent_label": "Chat",
                "confidence": 0.5,
                "suggested_action": raw_transcript
            }
    
    async def chat_with_context(
        self,
        message: str,
        context: str,
        user_profile: dict
    ) -> str:
        """Generate response with full memory context"""
        
        # Build prompt with context
        prompt = f"""
{context}

=== CURRENT REQUEST ===
User: {message}

Instructions:
- Use the memory context to provide personalized responses
- Adapt to user's cognitive needs:
  * ADHD: Keep responses concise with clear action items
  * Autism: Be explicit and literal, provide step-by-step
  * Dyslexia: Use simple language, avoid jargon
- Reference past conversations when relevant
- Remember user's preferences and coding patterns

User's cognitive needs: {', '.join(user_profile.get('cognitive_needs', []))}

Respond as AmbatuCode AI assistant.
"""
        
        response = await asyncio.to_thread(
            self.model.generate_content,
            prompt
        )
        
        return response.text.strip()
    
    async def extract_insight(self, message: str) -> Optional[dict]:
        """Determine if message contains important long-term info"""
        
        prompt = f"""Analyze this user message for important long-term information:

Message: "{message}"

Types of important information:
1. coding_pattern: User's coding preferences or patterns
2. preference: General preferences about tools, style, etc
3. project_context: Information about current project
4. cognitive_need: User's accessibility needs or adaptations

Return JSON:
{{
  "is_important": true/false,
  "category": "coding_pattern" | "preference" | "project_context" | "cognitive_need" | null,
  "title": "brief title" | null,
  "summary": "condensed version" | null,
  "importance": 0.0-1.0
}}

Return ONLY JSON.
"""
        
        try:
            response = await asyncio.to_thread(
                self.model.generate_content,
                prompt
            )
            
            text = response.text.strip()
            if text.startswith("```"):
                text = text.split("```")[1]
                if text.startswith("json"):
                    text = text[4:]
            
            analysis = json.loads(text.strip())
            
            return analysis if analysis.get("is_important") else None
            
        except Exception as e:
            return None
