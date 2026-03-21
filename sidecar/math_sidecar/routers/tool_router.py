"""DSPy-powered tool routing endpoint."""

from fastapi import APIRouter

from ..models import ToolRouteRequest, ToolRouteResponse

router = APIRouter()


@router.post("/route", response_model=ToolRouteResponse)
async def route_tools(request: ToolRouteRequest):
    """Classify which tools should handle a given math query."""
    query_lower = request.query.lower()

    tools = []
    reasoning_parts = []

    # Simple heuristic routing (DSPy optimization replaces this over time)
    computation_keywords = [
        "derivative", "integral", "integrate", "differentiate", "simplify",
        "factor", "expand", "solve", "limit", "series", "sum",
    ]
    numerical_keywords = [
        "matrix", "eigenvalue", "eigenvector", "numerical", "approximate",
        "signal", "fft", "interpolat",
    ]
    conceptual_keywords = [
        "what is", "explain", "why", "how does", "define", "theorem",
        "proof", "concept",
    ]

    if any(kw in query_lower for kw in computation_keywords):
        tools.append("sympy_compute")
        reasoning_parts.append("Symbolic computation detected")

    if any(kw in query_lower for kw in numerical_keywords):
        tools.append("octave_compute")
        reasoning_parts.append("Numerical computation detected")

    if any(kw in query_lower for kw in conceptual_keywords):
        tools.append("explain_concept")
        reasoning_parts.append("Conceptual question detected")

    # Always add wolfram for verification if we have a computation
    if "sympy_compute" in tools or "octave_compute" in tools:
        tools.append("wolfram_alpha")
        reasoning_parts.append("Added Wolfram Alpha for cross-verification")

    if not tools:
        tools.append("sympy_compute")
        reasoning_parts.append("Default to symbolic computation")

    return ToolRouteResponse(
        tools=tools,
        confidence=0.8 if len(reasoning_parts) > 1 else 0.6,
        reasoning="; ".join(reasoning_parts),
    )
