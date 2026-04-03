"""DSPy-powered tool routing endpoint."""

from fastapi import APIRouter

from ..models import ToolRouteRequest, ToolRouteResponse
from ..services.dspy_router import classify_tools

router = APIRouter()


@router.post("/route", response_model=ToolRouteResponse)
async def route_tools(request: ToolRouteRequest):
    """Classify which tools should handle a given math query."""
    route = classify_tools(request.query, request.context)
    return ToolRouteResponse(**route)
