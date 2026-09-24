/**
 * OmniSnap Live Engine API Client
 * Connects to Hugging Face ZeroGPU Gradio Space (simkeyur/omnisnap-engine)
 * Compatible with Gradio 6.x streaming call protocol.
 */

const ENGINE_URL = "https://simkeyur-omnisnap-engine.hf.space";

/**
 * Generic caller for Gradio 6 /gradio_api/call/<api_name> endpoints
 */
async function callGradioApi(apiName, dataArray) {
  const postUrl = `${ENGINE_URL}/gradio_api/call/${apiName}`;
  const postRes = await fetch(postUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: dataArray })
  });

  if (!postRes.ok) {
    throw new Error(`Engine call ${apiName} returned status ${postRes.status}`);
  }

  const { event_id } = await postRes.json();
  if (!event_id) throw new Error("No event_id returned from engine");

  const getUrl = `${ENGINE_URL}/gradio_api/call/${apiName}/${event_id}`;
  const sseRes = await fetch(getUrl);
  if (!sseRes.ok) throw new Error(`Engine stream returned status ${sseRes.status}`);

  const reader = sseRes.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Look for event: complete followed by data: [...]
    const lines = buffer.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('data: ')) {
        const rawJson = lines[i].slice(6).trim();
        try {
          const parsed = JSON.parse(rawJson);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const resultData = parsed[0];
            return typeof resultData === 'string' ? JSON.parse(resultData) : resultData;
          }
        } catch {
          // Keep buffering until complete JSON chunk
        }
      }
    }
  }

  throw new Error("Stream closed without complete data");
}

export async function callAnalyze({ imageBlob, domain, area, context = {}, localTime = "", customQuestion = "" }) {
  try {
    // Convert blob to base64 Data URL or File payload for Gradio
    const base64Data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(imageBlob);
    });

    const result = await callGradioApi("analyze", [
      base64Data,
      domain,
      area,
      JSON.stringify(context),
      localTime,
      customQuestion
    ]);

    return result;
  } catch (err) {
    console.warn("Live analyze call fallback to client mock:", err.message);
    return mockAnalyze({ domain, area, customQuestion });
  }
}

export async function callNote(alertPayload) {
  try {
    const result = await callGradioApi("note", [JSON.stringify(alertPayload)]);
    return result;
  } catch (err) {
    const place = alertPayload.place || alertPayload.area;
    const time = alertPayload.local_time || "recent";
    const q = alertPayload.q || "hazard";
    const p = Math.round((alertPayload.p || 0.8) * 100);
    return {
      note: `${place}, ${time}: observed ${q.replace(/_/g, ' ')} (${p}% probability). Please inspect and address as appropriate.`,
      gpu_ms: 0
    };
  }
}

function mockAnalyze({ domain, area, customQuestion }) {
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
    model: "akhilaaa3/Jev-Omni (client fallback)",
    pack: `${domain}/${area}@v2`,
    answers: mockAnswers,
    latency_ms: { total: 1800, per_question_median: 220 },
    gpu_ms: 1600
  };
}
