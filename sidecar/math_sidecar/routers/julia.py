"""Julia scientific-computing endpoint."""

from fastapi import APIRouter

from ..config import settings
from ..models import ScientificComputeRequest, ScientificComputeResponse
from ..services.julia_sandbox import run_julia

router = APIRouter()


@router.post("/julia", response_model=ScientificComputeResponse)
async def julia_compute(request: ScientificComputeRequest):
    result = run_julia(request.code, timeout=settings.scientific_timeout_seconds)
    return ScientificComputeResponse(
        engine="julia",
        ok=result["ok"],
        result=result["result"],
        error=result["error"],
        duration_ms=result["duration_ms"],
        metadata={
            "description": request.description,
            "expected_result": request.expected_result,
        },
    )
