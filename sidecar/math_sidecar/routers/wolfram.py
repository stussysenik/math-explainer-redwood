"""Wolfram Alpha proxy endpoint."""

from fastapi import APIRouter, HTTPException

from ..config import settings
from ..models import WolframRequest, WolframResponse
from ..services.wolfram_client import query_wolfram

router = APIRouter()


@router.post("/wolfram", response_model=WolframResponse)
async def wolfram_query(request: WolframRequest):
    if not settings.wolfram_app_id:
        raise HTTPException(status_code=503, detail="Wolfram Alpha not configured")

    result = await query_wolfram(request.query, settings.wolfram_app_id)
    return WolframResponse(**result)
