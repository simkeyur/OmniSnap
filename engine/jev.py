from typing import List, Dict, Any

def compute_score_expected_value(probs: List[float]) -> float:
    """
    Computes ev = Σ i·p_i / (n−1) ∈ [0, 1] for ordered levels.
    """
    n = len(probs)
    if n <= 1:
        return 0.0
    ev = sum(i * p for i, p in enumerate(probs)) / (n - 1)
    return round(ev, 4)

def format_noul_answer(p_yes: float) -> Dict[str, Any]:
    return {
        "p": round(p_yes, 4),
        "signal": round(p_yes, 4)
    }

def format_score_answer(probs: List[float], labels: List[str]) -> Dict[str, Any]:
    ev = compute_score_expected_value(probs)
    argmax_idx = probs.index(max(probs))
    return {
        "distribution": [round(p, 4) for p in probs],
        "argmax": labels[argmax_idx] if argmax_idx < len(labels) else "",
        "ev": ev,
        "signal": ev
    }
