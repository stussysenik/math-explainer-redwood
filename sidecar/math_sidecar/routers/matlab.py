"""MATLAB scientific-computing endpoint."""

from fastapi import APIRouter

from ..config import settings
from ..models import ScientificComputeRequest, ScientificComputeResponse
from ..services.matlab_bridge import run_matlab

router = APIRouter()


@router.post("/matlab", response_model=ScientificComputeResponse)
async def matlab_compute(request: ScientificComputeRequest):
    result = run_matlab(request.code, timeout=settings.scientific_timeout_seconds)
    return ScientificComputeResponse(
        engine="matlab",
        ok=result["ok"],
        result=result["result"],
        error=result["error"],
        duration_ms=result["duration_ms"],
        metadata={
            "description": request.description,
            "expected_result": request.expected_result,
        },
    )
