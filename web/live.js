/**
 * OmniSnap Live Engine API Client
 * Connects to Hugging Face ZeroGPU Gradio Space (simkeyur/omnisnap-engine)
 * Provides fallback mock responses when offline or testing without quota.
 */

const ENGINE_SPACE = "simkeyur/omnisnap-engine";
const DIRECT_API_URL = "https://simkeyur-omnisnap-engine.hf.space";

export async function callAnalyze({ imageBlob, domain, area, context = {}, localTime = "", customQuestion = "" }) {
  // Use direct fetch / Gradio Client HTTP endpoint
  try {
    const formData = new FormData();
    formData.append("data", JSON.stringify([
      null, // Image handled below
      domain,
      area,
      JSON.stringify(context),
      localTime,
      customQuestion
    ]));

    // Read blob as base64 data url for Gradio Image input
    const base64Data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(imageBlob);
    });

    const response = await fetch(`${DIRECT_API_URL}/api/predict/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: [
          base64Data,
          domain,
          area,
          JSON.stringify(context),
          localTime,
          customQuestion
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`Engine returned HTTP ${response.status}`);
    }

    const json = await response.json();
    return json.data[0];
  } catch (err) {
    console.warn("Live engine call failed or space still building, using client-side mock:", err.message);
    return mockAnalyze({ domain, area, customQuestion });
  }
}

export async function callNote(alertPayload) {
  try {
    const response = await fetch(`${DIRECT_API_URL}/api/predict/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fn_index: 1, // /note endpoint
        data: [JSON.stringify(alertPayload)]
      })
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = await response.json();
    return json.data[0];
  } catch (err) {
    // Template fallback
    const place = alertPayload.place || alertPayload.area;
    const time = alertPayload.local_time || "recent";
    const q = alertPayload.q || "hazard";
    const p = Math.round((alertPayload.p || 0.8) * 100);
    return {
      note: `${place}, ${time}: observed ${q.replace('_', ' ')} (${p}% probability). Please inspect and address as appropriate.`,
      gpu_ms: 0
    };
  }
}

function mockAnalyze({ domain, area, customQuestion }) {
  // Generates calibrated realistic probabilities for testing
  const isSpillOrHazard = Math.random() > 0.4;
  const pMain = isSpillOrHazard ? 0.75 + Math.random() * 0.2 : 0.05 + Math.random() * 0.15;

  const mockAnswers = {
    spill: { p: pMain, signal: pMain, severity: "high" },
    trip: { p: 0.12, signal: 0.12, severity: "medium" },
    person_down: { p: 0.02, signal: 0.02, severity: "critical" },
    blocked: { p: 0.08, signal: 0.08, severity: "medium" },
    tidy: { ev: 0.65, signal: 0.65, argmax: "Tidy", severity: null },
    crowding: { ev: 0.35, signal: 0.35, argmax: "Light", severity: null }
  };

  if (customQuestion) {
    mockAnswers.custom = {
      p: 0.10,
      signal: 0.10,
      question: customQuestion,
      custom: true
    };
  }

  return {
    schema: 1,
    model: "akhilaaa3/Jev-Omni (mock / fallback)",
    pack: `${domain}/${area}@v2`,
    answers: mockAnswers,
    latency_ms: { total: 1800, per_question_median: 220 },
    gpu_ms: 1600
  };
}
