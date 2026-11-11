from supabase import create_client, Client
import os
from typing import List, Dict, Any, Optional
from models.schemas import UserProfile

class SupabaseService:
    def __init__(self):
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_ANON_KEY")
        if not url or not key:
             # Basic error handling or warning, though we expect env vars
             print("Warning: SUPABASE_URL or SUPABASE_ANON_KEY not set")
        self.client: Client = create_client(url or "", key or "")
    
    async def insert_conversation(
        self,
        user_id: str,
        session_id: str,
        role: str,
        content: str,
        embedding: List[float]
    ) -> Dict[str, Any]:
        """Insert message into conversations table"""
        
        data = {
            "user_id": user_id,
            "session_id": session_id,
            "role": role,
            "content": content,
            "embedding": embedding,
            "metadata": {}
        }
        
        # supabase-py v2 usually returns an object with .data, but API might vary by version.
        # The user provided code uses .execute().data[0]
        result = self.client.table("conversations").insert(data).execute()
        return result.data[0] if result.data else None
    
    async def search_similar_conversations(
        self,
        user_id: str,
        query_embedding: List[float],
        match_threshold: float = 0.7,
        match_count: int = 5,
        session_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Search for similar conversations using vector similarity"""
        
        result = self.client.rpc(
            "match_conversations",
            {
                "query_embedding": query_embedding,
                "match_threshold": match_threshold,
                "match_count": match_count,
                "p_user_id": user_id,
                "p_session_id": session_id
            }
        ).execute()
        
        return result.data if result.data else []
    
    async def insert_insight(
        self,
        user_id: str,
        category: str,
        title: str,
        content: str,
        embedding: List[float],
        importance_score: float
    ) -> Dict[str, Any]:
        """Insert long-term insight"""
        
        data = {
            "user_id": user_id,
            "category": category,
            "title": title,
            "content": content,
            "embedding": embedding,
            "importance_score": importance_score
        }
        
        result = self.client.table("memory_insights").insert(data).execute()
        return result.data[0] if result.data else None
    
    async def search_similar_insights(
        self,
        user_id: str,
        query_embedding: List[float],
        match_threshold: float = 0.75,
        match_count: int = 3
    ) -> List[Dict[str, Any]]:
        """Search for relevant long-term insights"""
        
        result = self.client.rpc(
            "match_insights",
            {
                "query_embedding": query_embedding,
                "match_threshold": match_threshold,
                "match_count": match_count,
                "p_user_id": user_id
            }
        ).execute()
        
        return result.data if result.data else []
    
    async def get_user_profile(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get user's cognitive profile"""
        
        result = self.client.table("user_profiles") \
            .select("*") \
            .eq("user_id", user_id) \
            .single() \
            .execute()
        
        return result.data if result.data else None
    
    async def upsert_user_profile(self, profile: UserProfile) -> Dict[str, Any]:
        """Create or update user profile"""
        
        data = profile.dict()
        result = self.client.table("user_profiles").upsert(data).execute()
        return result.data[0] if result.data else None
