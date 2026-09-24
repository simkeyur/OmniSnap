import os
from pathlib import Path
from PIL import Image

MODEL_ID = "akhilaaa3/Jev-Omni"

_classifier = None

def get_classifier():
    global _classifier
    if _classifier is not None:
        return _classifier

    import torch
    if torch.cuda.is_available():
        from huggingface_hub import snapshot_download
        import importlib.util

        merged = snapshot_download(MODEL_ID)
        spec = importlib.util.spec_from_file_location("jev_omni_loader", Path(merged) / "jev_omni.py")
        loader_mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(loader_mod)
        _classifier = loader_mod.load_jev_omni(device="cuda")
    else:
        # Mock classifier for testing / CPU environments
        class MockJevOmni:
            def predict(self, *, state, question, options, media=None, modality="image", video_frames=16):
                p = 0.85 if "spill" in question.lower() or "wet" in question.lower() else 0.15
                if len(options) == 2 and options[0] == "Yes" and options[1] == "No":
                    return {
                        "prediction": "Yes" if p >= 0.5 else "No",
                        "confidence": p if p >= 0.5 else 1.0 - p,
                        "probabilities": {"Yes": p, "No": round(1.0 - p, 4)}
                    }
                else:
                    probs = [round(1.0 / len(options), 4) for _ in options]
                    probs[0] = round(1.0 - sum(probs[1:]), 4)
                    return {
                        "prediction": options[0],
                        "confidence": probs[0],
                        "probabilities": dict(zip(options, probs))
                    }
        _classifier = MockJevOmni()

    return _classifier
