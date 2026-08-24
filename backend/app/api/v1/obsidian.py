from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.db.database import get_db
from app.models.user import User
from app.api.dependencies import RequireRole, get_current_active_user
from app.services.obsidian_parser import ObsidianParser
from app.services.obsidian_api_client import ObsidianApiClient

router = APIRouter()

class SyncLocalApiRequest(BaseModel):
    api_url: str
    api_key: str

@router.post("/sync-local-api", dependencies=[Depends(RequireRole(["ADMIN", "TEACHER"]))])
async def sync_obsidian_local_api(
    req: SyncLocalApiRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    results = {"success": 0, "skipped": 0, "error": 0, "details": []}
    
    api_client = ObsidianApiClient(req.api_url, req.api_key)
    parser = ObsidianParser(db, current_user.id)
    
    try:
        # Fetch all markdown files from the vault
        files_data = await api_client.get_all_markdown_contents()
        
        for filename, file_content in files_data:
            try:
                result = await parser.parse_and_import(filename, file_content)
                if result["status"] == "success":
                    results["success"] += 1
                elif result["status"] == "skipped":
                    results["skipped"] += 1
                else:
                    results["error"] += 1
                
                results["details"].append({
                    "file": filename,
                    "status": result["status"],
                    "reason": result.get("reason"),
                    "question_id": result.get("question_id")
                })
            except Exception as e:
                results["error"] += 1
                results["details"].append({
                    "file": filename,
                    "status": "error",
                    "reason": str(e)
                })
                
        await db.commit()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to communicate with Obsidian Local REST API: {str(e)}")
        
    return results
