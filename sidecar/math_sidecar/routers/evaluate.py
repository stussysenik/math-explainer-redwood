"""Evaluation endpoint for scoring engine results."""

from fastapi import APIRouter

from ..models import EvaluateRequest, EvaluateResponse

router = APIRouter()


def _normalize(expr: str) -> str:
    """Strip whitespace and normalize caret notation."""
    return expr.strip().lower().replace(" ", "").replace("^", "**")


def _sympy_equal(expected: str, actual: str) -> bool | None:
    """Try semantic equality via SymPy. Returns None if SymPy unavailable."""
    try:
        from sympy import simplify
        from sympy.parsing.sympy_parser import parse_expr

        e = parse_expr(expected.replace("^", "**"))
        a = parse_expr(actual.replace("^", "**"))
        return simplify(e - a) == 0
    except Exception:
        return None


@router.post("/evaluate", response_model=EvaluateResponse)
async def evaluate_result(request: EvaluateRequest):
    """Score an engine result against expected output."""
    norm_expected = _normalize(request.expected)
    norm_actual = _normalize(request.actual)

    # Fast path: exact string match
    if norm_expected == norm_actual:
        return EvaluateResponse(
            score=1.0, correct=True, feedback="Exact match"
        )

    # Slow path: semantic equality via SymPy simplification
    sympy_result = _sympy_equal(request.expected, request.actual)
    if sympy_result is True:
        return EvaluateResponse(
            score=1.0, correct=True, feedback="Semantically equivalent (SymPy)"
        )

    return EvaluateResponse(
        score=0.0,
        correct=False,
        feedback=f"Expected '{request.expected}', got '{request.actual}'",
    )
