"""Scientific tool routing service with DSPy/LangChain fallback stack."""

from __future__ import annotations

import json
from functools import lru_cache

from pydantic import BaseModel, Field

from ..config import settings
from .tracing import traceable

try:  # pragma: no cover - optional dependency
    import dspy
except Exception:  # pragma: no cover - optional dependency
    dspy = None

try:  # pragma: no cover - optional dependency
    from langchain_core.prompts import ChatPromptTemplate
    from langchain_openai import ChatOpenAI
except Exception:  # pragma: no cover - optional dependency
    ChatPromptTemplate = None
    ChatOpenAI = None


class ToolRoutePlan(BaseModel):
    tools: list[str] = Field(default_factory=list)
    confidence: float = 0.0
    reasoning: str = ""


SYSTEM_ROUTING_PROMPT = """
You are routing advanced mathematics and scientific-computing problems.
Prefer verified-first execution and explicit multi-engine plans.

Available tools:
- sympy_compute: symbolic algebra, exact calculus, simplification, solving
- julia_compute: high-performance scientific/numerical computing
- matlab_compute: local proprietary scientific workflows if specifically requested or preferred
- octave_compute: GNU Octave fallback for MATLAB-style numerical work
- wolfram_alpha: cross-verification and external computational check
- explain_concept: theory, proofs, definitions, pedagogy

Return tools in the order they should execute. For graduate-level math, prefer symbolic exactness first,
then numerical/scientific engines when needed, and add wolfram_alpha when verification is helpful.
""".strip()


@traceable(name="tool_router.classify_tools")
def classify_tools(query: str, context: dict | None = None) -> dict:
    """Classify which tools should handle a query."""
    normalized_context = context or {}

    if dspy is not None and settings.dspy_model:
        try:
            plan = _dspy_classify(query, normalized_context)
            plan["backend"] = "dspy"
            return plan
        except Exception:
            pass

    if ChatOpenAI is not None and ChatPromptTemplate is not None and settings.langchain_model:
        try:
            plan = _langchain_classify(query, normalized_context)
            plan["backend"] = "langchain"
            return plan
        except Exception:
            pass

    plan = _heuristic_classify(query, normalized_context)
    plan["backend"] = "heuristic"
    return plan


def _normalize_tools(raw_tools: object, query: str, context: dict | None = None) -> list[str]:
    context = context or {}
    if isinstance(raw_tools, str):
        tools = [item.strip() for item in raw_tools.split(",") if item.strip()]
    elif isinstance(raw_tools, list):
        tools = [str(item).strip() for item in raw_tools if str(item).strip()]
    else:
        tools = []

    normalized: list[str] = []
    valid_tools = {
        "sympy_compute",
        "julia_compute",
        "matlab_compute",
        "octave_compute",
        "wolfram_alpha",
        "explain_concept",
    }

    for tool in tools:
        if tool in valid_tools and tool not in normalized:
            normalized.append(tool)

    if not normalized:
        normalized = _heuristic_classify(query, context)["tools"]

    return normalized


@lru_cache(maxsize=1)
def _get_dspy_module():  # pragma: no cover - depends on optional dependency
    assert dspy is not None

    class ToolRouteSignature(dspy.Signature):
        query: str = dspy.InputField()
        context_json: str = dspy.InputField()
        tools: list[str] = dspy.OutputField(desc="ordered tool names")
        confidence: float = dspy.OutputField(desc="0 to 1 confidence")
        reasoning: str = dspy.OutputField()

    kwargs = {}
    if settings.dspy_api_key:
        kwargs["api_key"] = settings.dspy_api_key
    if settings.dspy_api_base:
        kwargs["api_base"] = settings.dspy_api_base

    lm = dspy.LM(settings.dspy_model, **kwargs)
    dspy.configure(lm=lm)
    return dspy.ChainOfThought(ToolRouteSignature)


def _dspy_classify(query: str, context: dict | None = None) -> dict:  # pragma: no cover - optional runtime
    predictor = _get_dspy_module()
    prediction = predictor(
        query=query,
        context_json=json.dumps(context or {}, sort_keys=True),
    )

    tools = _normalize_tools(getattr(prediction, "tools", []), query, context)
    confidence = getattr(prediction, "confidence", 0.75)
    try:
        confidence = float(confidence)
    except Exception:
        confidence = 0.75

    return {
        "tools": tools,
        "confidence": max(0.0, min(confidence, 1.0)),
        "reasoning": str(getattr(prediction, "reasoning", "DSPy scientific routing")),
    }


@lru_cache(maxsize=1)
def _get_langchain_model():  # pragma: no cover - optional runtime
    assert ChatOpenAI is not None

    kwargs = {
        "model": settings.langchain_model,
        "temperature": 0,
    }
    if settings.langchain_api_key:
        kwargs["api_key"] = settings.langchain_api_key
    if settings.langchain_api_base:
        kwargs["base_url"] = settings.langchain_api_base

    return ChatOpenAI(**kwargs)


def _langchain_classify(query: str, context: dict | None = None) -> dict:  # pragma: no cover - optional runtime
    assert ChatPromptTemplate is not None

    prompt = ChatPromptTemplate.from_messages([
        ("system", SYSTEM_ROUTING_PROMPT),
        (
            "human",
            "Query:\n{query}\n\nContext JSON:\n{context_json}\n\nReturn a structured route plan.",
        ),
    ])
    model = _get_langchain_model().with_structured_output(ToolRoutePlan)
    chain = prompt | model

    plan = chain.invoke({
        "query": query,
        "context_json": json.dumps(context or {}, sort_keys=True),
    })

    return {
        "tools": _normalize_tools(plan.tools, query, context),
        "confidence": max(0.0, min(float(plan.confidence), 1.0)),
        "reasoning": plan.reasoning or "LangChain structured route plan",
    }


def _heuristic_classify(query: str, context: dict | None = None) -> dict:
    """Scientific routing fallback when no LM orchestration backend is configured."""
    context = context or {}
    query_lower = query.lower()
    preferred_engine = str(context.get("preferred_engine", "")).lower()
    strict_verification = bool(context.get("strict_verification", True))

    tools: list[str] = []
    reasoning: list[str] = []

    symbolic_kw = [
        "derivative",
        "integral",
        "diff",
        "integrate",
        "simplify",
        "factor",
        "expand",
        "solve",
        "limit",
        "series",
        "residue",
        "laplace",
        "fourier",
    ]
    conceptual_kw = [
        "what is",
        "explain",
        "why",
        "how does",
        "define",
        "theorem",
        "proof",
        "derive",
    ]
    matlab_kw = ["matlab", "simulink", "control toolbox"]
    julia_kw = ["julia", "differentialequations", "flux", "optimization.jl"]
    scientific_kw = [
        "matrix",
        "eigenvalue",
        "eigenvector",
        "numerical",
        "approximate",
        "fft",
        "signal",
        "ode",
        "pde",
        "optimization",
        "stiff",
        "simulation",
        "linear system",
        "probability distribution",
    ]

    if any(kw in query_lower for kw in symbolic_kw):
        tools.append("sympy_compute")
        reasoning.append("Exact symbolic structure detected")

    if any(kw in query_lower for kw in conceptual_kw):
        tools.append("explain_concept")
        reasoning.append("Conceptual or proof-oriented request detected")

    wants_matlab = preferred_engine == "matlab" or any(kw in query_lower for kw in matlab_kw)
    wants_julia = preferred_engine == "julia" or any(kw in query_lower for kw in julia_kw)
    needs_scientific = any(kw in query_lower for kw in scientific_kw)

    if needs_scientific or wants_matlab or wants_julia:
        if wants_matlab:
            tools.append("matlab_compute")
            reasoning.append("MATLAB-specific scientific workflow requested")
        elif wants_julia or "high_performance" in context:
            tools.append("julia_compute")
            reasoning.append("Julia selected for high-performance scientific computing")
        else:
            tools.append("octave_compute")
            reasoning.append("Numerical/scientific computing detected")

    if not tools:
        tools.append("sympy_compute")
        reasoning.append("Defaulting to verified symbolic computation")

    if strict_verification and any(
        tool in tools for tool in ("sympy_compute", "julia_compute", "matlab_compute", "octave_compute")
    ):
        tools.append("wolfram_alpha")
        reasoning.append("Added external verification layer")

    deduped_tools: list[str] = []
    for tool in tools:
        if tool not in deduped_tools:
            deduped_tools.append(tool)

    confidence = 0.9 if len(reasoning) >= 3 else 0.8 if len(reasoning) == 2 else 0.65

    return {
        "tools": deduped_tools,
        "confidence": confidence,
        "reasoning": "; ".join(reasoning),
    }
