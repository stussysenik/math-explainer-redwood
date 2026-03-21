"""SymPy evaluation endpoint — validates and executes symbolic math expressions."""

import re
from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel
from sympy import (
    Abs,
    Derivative,
    Eq,
    Float,
    Function,
    Integer,
    Integral,
    Matrix,
    Rational,
    S,
    Symbol,
    binomial,
    cos,
    diff,
    expand,
    exp,
    factor,
    factorial,
    integrate,
    latex,
    limit,
    log,
    oo,
    pi,
    simplify,
    sin,
    solve,
    sqrt,
    sstr,
    summation,
    tan,
)
from sympy.parsing.sympy_parser import (
    convert_xor,
    implicit_multiplication_application,
    parse_expr,
    standard_transformations,
)

router = APIRouter()

# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------


class SymPyRequest(BaseModel):
    request_id: str
    sympy_executable: str


class SymPyResponse(BaseModel):
    request_id: str
    ok: bool
    result_string: Optional[str] = None
    result_latex: Optional[str] = None
    normalized_expression: Optional[str] = None
    error: Optional[str] = None


# ---------------------------------------------------------------------------
# SymPy sandbox constants (mirrored from sympy_runner.py)
# ---------------------------------------------------------------------------

TRANSFORMATIONS = standard_transformations + (
    implicit_multiplication_application,
    convert_xor,
)

ALLOWED_LOCALS: dict = {
    # Core operations
    "diff": diff,
    "integrate": integrate,
    "simplify": simplify,
    "expand": expand,
    "factor": factor,
    "solve": solve,
    "limit": limit,
    "summation": summation,
    # Trig + transcendental
    "sin": sin,
    "cos": cos,
    "tan": tan,
    "exp": exp,
    "log": log,
    "sqrt": sqrt,
    "Abs": Abs,
    # Combinatorics
    "factorial": factorial,
    "binomial": binomial,
    # Comparison / verification
    "Eq": Eq,
    # Constants
    "pi": pi,
    "oo": oo,
    "E": S.Exp1,
    "I": S.ImaginaryUnit,
    # Constructors
    "Matrix": Matrix,
    "Rational": Rational,
    "Integer": Integer,
    "Float": Float,
    "Function": Function,
    "Derivative": Derivative,
    "Integral": Integral,
    "S": S,
}

SAFE_GLOBALS: dict = {
    "__builtins__": {},
    "Symbol": Symbol,
    "Integer": Integer,
    "Float": Float,
    "Rational": Rational,
    "Eq": Eq,
    "Matrix": Matrix,
    "S": S,
}

for _sym in ("x", "y", "z"):
    ALLOWED_LOCALS[_sym] = Symbol(_sym)

BLOCKED_SUBSTRINGS = {"__", "import", "eval", "exec", "open", "lambda", "subprocess"}
BLOCKED_WORDS = {"os", "sys"}
BLOCKED_WORD_PATTERN = re.compile(r"\b(" + "|".join(BLOCKED_WORDS) + r")\b")
VALID_PATTERN = re.compile(r"^[A-Za-z0-9_(),+\-*/^ .\[\]:=<>|&!]+$")
IDENTIFIER_PATTERN = re.compile(r"[A-Za-z_][A-Za-z0-9_]*")


# ---------------------------------------------------------------------------
# Validation + execution helpers
# ---------------------------------------------------------------------------


def _validate_expression(expression: str) -> Optional[str]:
    """Return an error message string if *expression* is invalid, else None."""
    if not expression or len(expression) > 512:
        return "Expression is empty or too long."

    if not VALID_PATTERN.match(expression):
        return "Expression contains unsupported characters."

    lowered = expression.lower()
    for token in BLOCKED_SUBSTRINGS:
        if token in lowered:
            return f"Blocked token detected: {token}"

    word_match = BLOCKED_WORD_PATTERN.search(lowered)
    if word_match:
        return f"Blocked token detected: {word_match.group()}"

    # Allow known SymPy method names called on objects (e.g. Matrix.eigenvals())
    ALLOWED_METHODS = {
        "eigenvals", "eigenvects", "det", "inv", "transpose", "trace",
        "rref", "nullspace", "charpoly", "rank", "norm",
        "doit", "evalf", "subs", "rewrite", "series", "nsimplify",
        "cdf", "pdf", "Normal", "Binomial", "Poisson",
        "n", "t", "s", "f", "a", "b", "c", "r", "k", "p", "q",
        "True", "False", "None",
    }
    identifiers = IDENTIFIER_PATTERN.findall(expression)
    for identifier in identifiers:
        if identifier not in ALLOWED_LOCALS and identifier not in ALLOWED_METHODS:
            return f"Unsupported identifier: {identifier}"

    return None


def _execute_expression(expression: str) -> dict:
    """Parse and evaluate *expression* via SymPy, returning result strings."""
    parsed = parse_expr(
        expression,
        local_dict=ALLOWED_LOCALS,
        global_dict=SAFE_GLOBALS,
        transformations=TRANSFORMATIONS,
        evaluate=True,
    )
    return {
        "result_string": sstr(parsed),
        "result_latex": latex(parsed),
        "normalized_expression": sstr(parsed),
    }


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------


@router.post("/sympy", response_model=SymPyResponse)
async def evaluate_sympy(req: SymPyRequest) -> SymPyResponse:
    """Validate and evaluate a SymPy expression."""
    validation_error = _validate_expression(req.sympy_executable)
    if validation_error:
        return SymPyResponse(
            request_id=req.request_id,
            ok=False,
            error=validation_error,
        )

    try:
        result = _execute_expression(req.sympy_executable)
        return SymPyResponse(
            request_id=req.request_id,
            ok=True,
            result_string=result["result_string"],
            result_latex=result["result_latex"],
            normalized_expression=result["normalized_expression"],
        )
    except Exception as exc:
        return SymPyResponse(
            request_id=req.request_id,
            ok=False,
            error=str(exc),
        )
