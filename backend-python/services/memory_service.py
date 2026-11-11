from typing import List, Dict
from models.schemas import Message


class MemoryService:
    def __init__(self):
        self.session_cache: Dict[str, List[Message]] = {}

    async def add_message(
        self,
        user_id: str,
        session_id: str,
        message: Message
    ):
        """Add a message to the in-memory session history."""
        cache_key = f"{user_id}:{session_id}"
        if cache_key not in self.session_cache:
            self.session_cache[cache_key] = []

        self.session_cache[cache_key].append(message)

        if len(self.session_cache[cache_key]) > 20:
            self.session_cache[cache_key].pop(0)

    async def get_relevant_context(
        self,
        user_id: str,
        session_id: str,
        query: str
    ) -> str:
        """Build context from the in-memory session history."""
        cache_key = f"{user_id}:{session_id}"
        session_messages = self.session_cache.get(cache_key, [])
        session_context = "\n".join([
            f"{m.role}: {m.content}"
            for m in session_messages[:-1]
        ])

        return f"""You are AmbatuCode AI, a helpful coding assistant designed for developers recovering from hand injuries.
You help with coding questions, code generation, debugging, and explanations.
Respond in the same language as the user (Indonesian or English).

=== USER PROFILE ===
User Profile: Default

=== IMPORTANT INSIGHTS ===
No stored insights yet.

=== RELEVANT PAST CONVERSATIONS ===
No relevant past conversations.

=== CURRENT SESSION HISTORY ===
{session_context if session_context else "This is the start of the conversation."}
"""
