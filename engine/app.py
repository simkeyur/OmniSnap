try:
    import spaces
    gpu_decorator = spaces.GPU(duration=50)
    note_decorator = spaces.GPU(duration=15)
except (ImportError, AttributeError):
    def gpu_decorator(fn):
        return fn
    def note_decorator(fn):
        return fn

import json
import time
import os
import base64
import io
import tempfile
import traceback
from pathlib import Path
from PIL import Image
import gradio as gr

from limits import validate_image, validate_custom_question
from jev import format_noul_answer, format_score_answer
from packs import load_question_packs
from models import get_classifier
from notes import generate_incident_note

PACKS = load_question_packs()

@gpu_decorator
def analyze(image_data_or_path, domain: str, area: str, context_json: str = "{}", local_time: str = "", custom_question: str = ""):
    start_time = time.time()
    print(f"[Engine] /analyze request received for domain={domain}, area={area}")
    
    if not image_data_or_path:
        return json.dumps({"error": {"code": "bad_image", "message": "No image data provided"}})

    if domain not in PACKS["domains"]:
        return json.dumps({"error": {"code": "bad_domain", "message": f"Unknown domain: {domain}"}})

    domain_data = PACKS["domains"][domain]
    if area not in domain_data["areas"]:
        return json.dumps({"error": {"code": "bad_area", "message": f"Unknown area: {area} for domain {domain}"}})

    area_data = domain_data["areas"][area]
    questions = area_data["questions"]

    # Decode image from base64 data URL, file path, or bytes
    try:
        if isinstance(image_data_or_path, str):
            if image_data_or_path.startswith("data:image"):
                header, encoded = image_data_or_path.split(",", 1)
                image_bytes = base64.b64decode(encoded)
                image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            elif os.path.exists(image_data_or_path):
                image = Image.open(image_data_or_path).convert("RGB")
            else:
                # Try raw base64 decode
                image_bytes = base64.b64decode(image_data_or_path)
                image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        elif isinstance(image_data_or_path, dict) and "url" in image_data_or_path:
            url_val = image_data_or_path["url"]
            if url_val.startswith("data:image"):
                header, encoded = url_val.split(",", 1)
                image_bytes = base64.b64decode(encoded)
                image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            else:
                image = Image.open(url_val).convert("RGB")
        else:
            image = image_data_or_path.convert("RGB")

        image = validate_image(image)
    except Exception as e:
        traceback.print_exc()
        return json.dumps({"error": {"code": "bad_image", "message": f"Image processing failed: {str(e)}"}})

    try:
        custom_question = validate_custom_question(custom_question)
    except Exception as e:
        return json.dumps({"error": {"code": "bad_question", "message": str(e)}})

    # Format state string from template
    context = {}
    if context_json:
        try:
            context = json.loads(context_json) if isinstance(context_json, str) else context_json
        except Exception:
            context = {}

    template = domain_data.get("state_template", "Area: {area}.")
    state_str = template.format(
        area=area_data.get("label", area),
        local_time=local_time or "now",
        focus=context.get("focus", "general"),
        mode=context.get("mode", "move-in"),
        plant=context.get("plant", "plant")
    )

    try:
        classifier = get_classifier()
    except Exception as e:
        traceback.print_exc()
        return json.dumps({"error": {"code": "model_load_failed", "message": f"Failed to initialize Jev-Omni: {str(e)}"}})

    # Save image temporarily to pass to classifier
    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp_file:
        image.save(tmp_file.name, format="JPEG", quality=85)
        tmp_path = tmp_file.name

    answers = {}
    q_start_times = []

    try:
        for q in questions:
            q_id = q["id"]
            q_text = q["question"]
            q_type = q["type"]
            q_options = q.get("options", ["Yes", "No"]) if q_type != "noul" else ["Yes", "No"]

            t0 = time.time()
            res = classifier.predict(
                state=state_str,
                question=q_text,
                options=q_options,
                media=tmp_path,
                modality="image"
            )
            q_start_times.append(time.time() - t0)

            probs = [res["probabilities"][opt] for opt in q_options]
            if q_type == "noul":
                p_yes = res["probabilities"].get("Yes", probs[0])
                ans = format_noul_answer(p_yes)
                ans["severity"] = q.get("severity")
                answers[q_id] = ans
            elif q_type == "score":
                ans = format_score_answer(probs, q_options)
                ans["severity"] = q.get("severity")
                answers[q_id] = ans

        # Evaluate custom question if provided
        if custom_question:
            t0 = time.time()
            res = classifier.predict(
                state=state_str,
                question=custom_question,
                options=["Yes", "No"],
                media=tmp_path,
                modality="image"
            )
            q_start_times.append(time.time() - t0)
            p_yes = res["probabilities"].get("Yes", 0.5)
            ans = format_noul_answer(p_yes)
            ans["severity"] = None
            ans["custom"] = True
            ans["question"] = custom_question
            answers["custom"] = ans

    except Exception as e:
        traceback.print_exc()
        return json.dumps({"error": {"code": "inference_failed", "message": f"Jev-Omni inference error: {str(e)}"}})
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

    total_latency_ms = int((time.time() - start_time) * 1000)
    per_q_median = int(sorted(q_start_times)[len(q_start_times) // 2] * 1000) if q_start_times else 0

    return json.dumps({
        "schema": 1,
        "model": "akhilaaa3/Jev-Omni@c050d51354147985d13286cf4acf90f562f2c631",
        "pack": f"{domain}/{area}@v2",
        "answers": answers,
        "latency_ms": {
            "total": total_latency_ms,
            "per_question_median": per_q_median
        },
        "gpu_ms": total_latency_ms
    }, indent=2)

@note_decorator
def note(payload_json: str):
    t0 = time.time()
    try:
        payload = json.loads(payload_json) if isinstance(payload_json, str) else payload_json
    except Exception:
        payload = {}

    note_text = generate_incident_note(payload)
    elapsed_ms = int((time.time() - t0) * 1000)
    return json.dumps({
        "note": note_text,
        "gpu_ms": elapsed_ms
    }, indent=2)

def health():
    return json.dumps({
        "ok": True,
        "model": "akhilaaa3/Jev-Omni",
        "sha": "c050d51354147985d13286cf4acf90f562f2c631",
        "packs_version": PACKS.get("version", "2.0.0")
    }, indent=2)

with gr.Blocks(title="OmniSnap Engine") as demo:
    gr.Markdown("# OmniSnap Engine\nStateless ZeroGPU inference endpoint for Jev-Omni.")

    with gr.Tab("Analyze"):
        inp_img = gr.Textbox(label="Image (Base64 DataURL or File Path)", lines=3)
        inp_domain = gr.Textbox(value="store", label="Domain")
        inp_area = gr.Textbox(value="floor", label="Area")
        inp_ctx = gr.Textbox(value="{}", label="Context (JSON)")
        inp_time = gr.Textbox(value="", label="Local Time")
        inp_custom = gr.Textbox(value="", label="Custom Question")
        out_json = gr.Textbox(label="Analysis Result (JSON)", lines=15)
        btn_run = gr.Button("Analyze")
        btn_run.click(analyze, inputs=[inp_img, inp_domain, inp_area, inp_ctx, inp_time, inp_custom], outputs=out_json, api_name="analyze")

    with gr.Tab("Note"):
        inp_note_payload = gr.Textbox(value="{}", label="Alert Context JSON")
        out_note_json = gr.Textbox(label="Generated Note (JSON)", lines=5)
        btn_note = gr.Button("Generate Note")
        btn_note.click(note, inputs=[inp_note_payload], outputs=out_note_json, api_name="note")

    with gr.Tab("Health"):
        out_health = gr.Textbox(label="Status (JSON)", lines=5)
        btn_health = gr.Button("Check Health")
        btn_health.click(health, outputs=out_health, api_name="health")

if __name__ == "__main__":
    demo.launch(server_name="0.0.0.0", server_port=7860)
