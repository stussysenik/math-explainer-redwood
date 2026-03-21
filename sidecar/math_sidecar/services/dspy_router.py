"""DSPy-based tool routing service.

This module provides DSPy Signature + Predict for classifying which
computation tools should handle a given math query. The router improves
over time through DSPy's optimization loop.

NOTE: Requires dspy-ai to be installed. Falls back to heuristic routing
if DSPy is not available.
"""


def classify_tools(query: str, context: dict | None = None) -> dict:
    """Classify which tools should be used for a query.

    Returns dict with keys: tools (list[str]), confidence (float), reasoning (str)
    """
    try:
        return _dspy_classify(query, context)
    except Exception:
        return _heuristic_classify(query)


def _dspy_classify(query: str, context: dict | None = None) -> dict:
    """DSPy-powered classification. Placeholder for optimization loop."""
    # TODO: Implement DSPy Signature + Predict once dspy-ai is configured
    # For now, fall back to heuristic
    return _heuristic_classify(query)


def _heuristic_classify(query: str) -> dict:
    """Simple keyword-based classification as DSPy fallback."""
    query_lower = query.lower()
    tools = []
    reasoning = []

    symbolic_kw = ["derivative", "integral", "diff", "integrate", "simplify", "factor", "solve", "limit"]
    numerical_kw = ["matrix", "eigenvalue", "numerical", "approximate", "fft"]
    conceptual_kw = ["what is", "explain", "why", "how does", "define", "theorem"]

    if any(kw in query_lower for kw in symbolic_kw):
        tools.append("sympy_compute")
        reasoning.append("Symbolic computation keywords detected")

    if any(kw in query_lower for kw in numerical_kw):
        tools.append("octave_compute")
        reasoning.append("Numerical computation keywords detected")

    if any(kw in query_lower for kw in conceptual_kw):
        tools.append("explain_concept")
        reasoning.append("Conceptual question keywords detected")

    if not tools:
        tools.append("sympy_compute")
        reasoning.append("Default: symbolic computation")

    return {
        "tools": tools,
        "confidence": 0.7,
        "reasoning": "; ".join(reasoning),
    }
