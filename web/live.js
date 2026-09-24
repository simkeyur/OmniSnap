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
    throw new Error(`Engine call ${apiName} failed with HTTP ${postRes.status}`);
  }

  const { event_id } = await postRes.json();
  if (!event_id) throw new Error("No event_id returned from engine");

  const getUrl = `${ENGINE_URL}/gradio_api/call/${apiName}/${event_id}`;
  const sseRes = await fetch(getUrl);
  if (!sseRes.ok) throw new Error(`Engine stream failed with HTTP ${sseRes.status}`);

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
          // Keep buffering until complete chunk
        }
      }
    }
  }

  throw new Error("Stream closed without returning results");
}

export async function callAnalyze({ imageBase64, domain, area, context = {}, localTime = "", customQuestion = "" }) {
  try {
    const result = await callGradioApi("analyze", [
      imageBase64,
      domain,
      area,
      JSON.stringify(context),
      localTime,
      customQuestion
    ]);

    if (result && result.error) {
      throw new Error(result.error.message || result.error.code || "Model analysis failed");
    }

    return result;
  } catch (err) {
    console.error("Live analyze failed:", err);
    throw err;
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
