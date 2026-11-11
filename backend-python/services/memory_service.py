from typing import List, Optional, Dict
from services.gemini_service import GeminiService
from services.supabase_service import SupabaseService
from models.schemas import Message
import asyncio

class MemoryService:
    def __init__(self):
        self.gemini = GeminiService()
        self.supabase = SupabaseService()
        
        # Session memory (in-memory cache) — always works
        self.session_cache: Dict[str, List[Message]] = {}
    
    async def add_message(
        self,
        user_id: str,
        session_id: str,
        message: Message
    ):
        """Add message to all memory tiers (resilient — session cache always works)"""
        
        # 1. Always add to in-memory session cache
        cache_key = f"{user_id}:{session_id}"
        if cache_key not in self.session_cache:
            self.session_cache[cache_key] = []
        
        self.session_cache[cache_key].append(message)
        
        # Keep only last 20 messages in session
        if len(self.session_cache[cache_key]) > 20:
            self.session_cache[cache_key].pop(0)
        
        # 2. Try to generate embedding and store in Supabase (optional — won't break if fails)
        try:
            embedding = await self.gemini.generate_embedding(message.content)
            await self.supabase.insert_conversation(
                user_id=user_id,
                session_id=session_id,
                role=message.role,
                content=message.content,
                embedding=embedding
            )
        except Exception as e:
            print(f"[MemoryService] Supabase/embedding store skipped (non-fatal): {e}")
        
        # 3. Try to extract long-term insights for user messages (optional)
        if message.role == "user":
            try:
                await self._extract_and_store_insight(user_id, message)
            except Exception as e:
                print(f"[MemoryService] Insight extraction skipped (non-fatal): {e}")
    
    async def _extract_and_store_insight(
        self,
        user_id: str,
        message: Message
    ):
        """Extract and store long-term insights (Supabase optional)"""
        
        analysis = await self.gemini.extract_insight(message.content)
        
        if analysis and (
            analysis.get("importance_score", 0) > 0.6 or 
            analysis.get("importance", 0) > 0.6
        ):
            score = analysis.get("importance_score") or analysis.get("importance") or 0.5
            
            try:
                embedding = await self.gemini.generate_embedding(analysis["summary"])
                await self.supabase.insert_insight(
                    user_id=user_id,
                    category=analysis["category"],
                    title=analysis["title"],
                    content=analysis["summary"],
                    embedding=embedding,
                    importance_score=score
                )
            except Exception as e:
                print(f"[MemoryService] Insight Supabase store skipped (non-fatal): {e}")
    
    async def get_relevant_context(
        self,
        user_id: str,
        session_id: str,
        query: str
    ) -> str:
        """Build context from all memory tiers — always returns something from session cache"""
        
        # 1. Always get session memory (works without Supabase)
        cache_key = f"{user_id}:{session_id}"
        session_messages = self.session_cache.get(cache_key, [])
        # Exclude the last message as it's the current one being processed
        session_context = "\n".join([
            f"{m.role}: {m.content}"
            for m in session_messages[:-1]  # exclude last (current) user message
        ])
        
        rag_context = ""
        insights_context = ""
        profile_context = "User Profile: Default"

        # 2. Try Supabase RAG (optional)
        try:
            query_embedding = await self.gemini.generate_embedding(query)
            
            similar_conversations = await self.supabase.search_similar_conversations(
                user_id=user_id,
                query_embedding=query_embedding,
                match_count=3
            )
            
            rag_context = "\n".join([
                f"[Past] {conv['role']}: {conv['content']}"
                for conv in similar_conversations
            ])
            
            similar_insights = await self.supabase.search_similar_insights(
                user_id=user_id,
                query_embedding=query_embedding,
                match_count=3
            )
            
            insights_context = "\n".join([
                f"[Remember] {insight['title']}: {insight['content']}"
                for insight in similar_insights
            ])
        except Exception as e:
            print(f"[MemoryService] Supabase RAG skipped (non-fatal): {e}")
        
        # 3. Try Supabase user profile (optional)
        try:
            profile = await self.supabase.get_user_profile(user_id)
            if profile:
                profile_context = f"""User Profile:
- Cognitive needs: {', '.join(profile.get('cognitive_needs', []))}
- Preferred task size: {profile.get('preferred_chunk_size', 'small')}
- Needs frequent feedback: {profile.get('needs_frequent_feedback', False)}"""
        except Exception as e:
            print(f"[MemoryService] Profile load skipped (non-fatal): {e}")
        
        # 4. Combine context
        full_context = f"""You are AmbatuCode AI, a helpful coding assistant designed for neurodivergent developers.
You help with coding questions, code generation, debugging, and explanations.
Respond in the same language as the user (Indonesian or English).

=== USER PROFILE ===
{profile_context}

=== IMPORTANT INSIGHTS ===
{insights_context if insights_context else "No stored insights yet."}

=== RELEVANT PAST CONVERSATIONS ===
{rag_context if rag_context else "No relevant past conversations."}

=== CURRENT SESSION HISTORY ===
{session_context if session_context else "This is the start of the conversation."}
"""
        
        return full_context
