"""OMR Service — Hybrid OpenCV + Gemini Vision OMR processing."""

from app.services.omr.hybrid_omr import HybridOMREngine, HybridOMRResult
from app.services.omr.layout_config import SheetLayout
from app.services.omr.calibration import CalibrationTool

__all__ = [
    "HybridOMREngine",
    "HybridOMRResult",
    "SheetLayout",
    "CalibrationTool",
]
