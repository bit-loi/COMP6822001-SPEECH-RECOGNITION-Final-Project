from typing import Dict

class VoiceProcessor:
    """Clean and normalize voice transcripts"""
    
    # Common programming term mishearings
    CORRECTIONS = {
        "four loop": "for loop",
        "why loop": "while loop",
        "constant": "const",
        "lead": "let",
        "eye": "i",
        "jay": "j",
        "kay": "k",
        "ex": "x",
        "why": "y",
        "said": "z",
        "arrow function": "arrow function",
        "a sink": "async",
        "a weight": "await",
        "promise": "promise",
        "jason": "json",
        "tie script": "typescript",
        "react": "react",
        "view": "vue",
        "node": "node",
        "pie-thon": "python",
        "go lang": "golang",
    }
    
    @staticmethod
    def clean_transcript(raw_transcript: str) -> str:
        """Clean up speech recognition errors"""
        
        cleaned = raw_transcript.lower().strip()
        
        # Apply corrections
        for wrong, right in VoiceProcessor.CORRECTIONS.items():
            cleaned = cleaned.replace(wrong, right)
        
        return cleaned
    
    @staticmethod
    def detect_language_from_speech(transcript: str) -> str:
        """Detect programming language from voice command"""
        
        lower = transcript.lower()
        
        language_keywords = {
            "javascript": ["javascript", "js", "node"],
            "typescript": ["typescript", "ts"],
            "python": ["python", "py"],
            "java": ["java"],
            "go": ["golang", "go"],
            "rust": ["rust"],
            "c++": ["c plus plus", "cpp"],
            "ruby": ["ruby"],
        }
        
        for lang, keywords in language_keywords.items():
            if any(kw in lower for kw in keywords):
                return lang
        
        return "javascript"  # default
