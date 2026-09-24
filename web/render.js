/**
 * OmniSnap UI Renderer
 * Renders domain selector, results card, timeline, and alert feed
 */

export function renderResults(results, domainData, onCheckAnother, onViewSession) {
  const answers = results.answers || {};
  const entries = Object.entries(answers);

  let html = `
    <div style="background:var(--surface-1);border-radius:var(--radius);padding:12px;margin-bottom:12px">
      <div style="font-weight:600;font-size:14px;margin-bottom:4px">Check Summary (${results.pack})</div>
      <div class="ss-muted">${results.latency_ms?.total || 1800} ms · Powered by Jev-Omni</div>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px">
  `;

  for (const [qId, ans] of entries) {
    const isScore = ans.argmax !== undefined;
    const valStr = isScore ? `${ans.argmax} (ev: ${Math.round(ans.ev * 100)}%)` : `${Math.round(ans.p * 100)}%`;
    const pct = isScore ? Math.round(ans.ev * 100) : Math.round(ans.p * 100);

    let bandColor = "var(--fill-success)";
    if (pct >= 70) bandColor = "var(--fill-danger)";
    else if (pct >= 40) bandColor = "var(--fill-warning)";

    html += `
      <div class="ss-row">
        <div style="flex:1;min-width:0">
          <div style="font-weight:500">${ans.question || qId.replace('_', ' ')}</div>
          <div class="ss-bar">
            <div style="height:100%;width:${pct}%;background:${bandColor}"></div>
          </div>
        </div>
        <span class="ss-muted" style="width:50px;text-align:right">${valStr}</span>
      </div>
    `;
  }

  html += `
    </div>
    <div style="margin-top:auto;display:flex;flex-direction:column;gap:8px;padding-top:16px">
      <button class="ss-btn ss-pri" id="btn-check-another"><i class="ti ti-camera"></i> Check Another Photo</button>
      <button class="ss-btn" id="btn-view-session"><i class="ti ti-history"></i> View Session Timeline</button>
    </div>
  `;

  return html;
}
