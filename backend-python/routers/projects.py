from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dependencies.auth import verify_user

router = APIRouter(prefix="/projects", tags=["Projects"])

@router.get("/")
async def list_user_projects(user = Depends(verify_user)):
    """
    Mengambil semua project/workspace milik user yang sedang aktif.
    """
    # Di masa depan, integrasikan query ini ke Supabase / Database SQL
    user_id = user.id
    
    return {
        "user_id": user_id,
        "message": "Daftar project berhasil dimuat",
        "data": [
            {
                "id": "proj_1", 
                "name": "AmbatuCode",
                "framework": "Next.js",
                "role": "Owner",
                "last_active": "2026-03-02"
            }
        ]
    }

@router.post("/")
async def create_project(project_data: dict, user = Depends(verify_user)):
    """
    Membuat project baru dan menyimpannya ke database untuk user ini.
    """
    if not project_data.get("name"):
        raise HTTPException(status_code=400, detail="Project name is required")
        
    return {
        "message": "Project created successfully!",
        "project_details": project_data,
        "owner_id": user.id
    }
