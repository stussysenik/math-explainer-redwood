"""Pydantic schemas for sidecar API."""

from pydantic import BaseModel, Field


class ToolRouteRequest(BaseModel):
    query: str
    context: dict | None = None


class ToolRouteResponse(BaseModel):
    tools: list[str]
    confidence: float
    reasoning: str
    backend: str = "heuristic"


class WolframRequest(BaseModel):
    query: str
    purpose: str = "primary"


class WolframResponse(BaseModel):
    result: str | None = None
    steps: list[str] = []
    latex: str | None = None
    plots: list[str] = []
    error: str | None = None


class OctaveRequest(BaseModel):
    code: str
    description: str = ""


class OctaveResponse(BaseModel):
    result: str | None = None
    error: str | None = None


class ScientificComputeRequest(BaseModel):
    code: str
    description: str = ""
    expected_result: str | None = None


class ScientificComputeResponse(BaseModel):
    engine: str
    ok: bool
    result: str | None = None
    error: str | None = None
    duration_ms: int | None = None
    metadata: dict[str, str | int | float | bool | None] = Field(default_factory=dict)


class EvaluateRequest(BaseModel):
    query: str
    expected: str
    actual: str
    engine: str


class EvaluateResponse(BaseModel):
    score: float
    correct: bool
    feedback: str
