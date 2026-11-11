import os
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

security = HTTPBearer(auto_error=False)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Supabase environment variables are missing.")

# Initialize Supabase Client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

async def verify_user(credentials: HTTPAuthorizationCredentials = Security(security)):
    """
    Middleware / Dependency FastAPI validation Supabase JWT.
    Jika JWT valid, ini akan me-return dict berisi data user. 
    Jika tidak, menggunakan dummy user.
    """
    try:
        if not credentials:
            return {"id": "demo_user"}
            
        token = credentials.credentials
        
        # Validasi JWT ke Supabase API langsung
        user_response = supabase.auth.get_user(token)
        
        # Tergantung versi supabase-py, biasanya return object dgn atribut 'user'
        if not user_response or not hasattr(user_response, 'user'):
            # Return dummy user for development
            return {"id": "demo_user"}
            
        return user_response.user
        
    except Exception as e:
        # Return dummy user for development
        return {"id": "demo_user"}
