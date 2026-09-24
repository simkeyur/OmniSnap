import { decide, DEFAULT_PARAMS, computeTau, classifyBand } from './policy.js';
import { processImageFile, CameraStream } from './capture.js';
import { callAnalyze, callNote } from './live.js';

let PACKS = null;

// Application State
const STATE = {
  screen: 'welcome',
  domain: 'store',
  area: 'floor',
  chip: 0,
  snapshots: [],
  resolvedAlerts: new Set(),
  policyParams: JSON.parse(JSON.stringify(DEFAULT_PARAMS)),
  sensitivity: 50,
  confirm: 2,
  lastResult: null,
  activeStream: null
};

const $ = id => document.getElementById(id);

async function loadPacks() {
  try {
    const res = await fetch('question-packs.json');
    PACKS = await res.json();
  } catch (e) {
    console.error("Failed to load question-packs.json", e);
  }
}

function D() {
  return PACKS?.domains?.[STATE.domain] || {};
}

function A() {
  return D().areas?.[STATE.area] || Object.values(D().areas || {})[0] || {};
}

const hdr = (title, back) => `
  <div style="display:flex;align-items:center;justify-content:space-between;gap:6px">
    <div style="display:flex;align-items:center;gap:6px;min-width:0">
      ${back ? `<button aria-label="Back" id="hdr-back" data-go="${back}" style="height:28px;padding:0 8px"><i class="ti ti-arrow-left"></i></button>` : '<i class="ti ti-shield-check" style="font-size:20px;color:var(--text-accent)"></i>'}
      <span style="font-weight:600;font-size:15px">${title}</span>
    </div>
    <button data-go="domains" style="height:26px;font-size:11px;padding:0 8px;border-radius:var(--radius);background:var(--surface-1);color:var(--text-secondary);border:none">
      <i class="ti ${D().icon || 'ti-building-store'}"></i> ${D().label || 'Store'}
    </button>
  </div>
`;

const foot = () => `
  <p class="ss-muted" style="margin-top:auto;font-size:11px;text-align:center">
    ${D().disclaimer || 'Demo only, not a safety system'}
  </p>
`;

const SCREENS = {
  welcome: () => `
    <div style="text-align:center;margin-top:24px">
      <div style="width:60px;height:60px;border-radius:50%;background:var(--bg-accent);color:var(--text-accent);display:flex;align-items:center;justify-content:center;margin:0 auto 12px;font-size:32px">
        <i class="ti ti-shield-check"></i>
      </div>
      <p style="font-size:20px;font-weight:600;margin:0 0 6px">OmniSnap</p>
      <p class="ss-muted" style="font-size:13px;line-height:1.4">
        A second pair of eyes for your shift, home, or fleet. Snap a photo to get instant calibrated safety decisions.
      </p>
    </div>

    <div style="display:flex;flex-direction:column;gap:12px;margin:20px 0">
      ${[
        ['ti-lock', 'Privacy by design', 'Photos are downscaled, EXIF-stripped in-browser, and never stored.'],
        ['ti-gauge', 'Calibrated probabilities', 'Model returns confidence numbers rather than hallucinations.'],
        ['ti-bolt', 'Instant policy sliders', 'Change threshold rules with zero new model queries.']
      ].map(([icon, title, desc]) => `
        <div style="display:flex;gap:10px;align-items:flex-start">
          <i class="ti ${icon}" style="font-size:20px;color:var(--text-accent);margin-top:2px"></i>
          <div>
            <div style="font-weight:500;font-size:13px">${title}</div>
            <div class="ss-muted" style="font-size:11px">${desc}</div>
          </div>
        </div>
      `).join('')}
    </div>

    <button class="ss-btn ss-pri" data-go="domains"><i class="ti ti-arrow-right"></i> Choose Domain</button>
    <button class="ss-btn" data-go="shift"><i class="ti ti-history"></i> View Session (${STATE.snapshots.length} snapshots)</button>
    ${foot()}
  `,

  domains: () => `
    ${hdr("What are you checking?", "welcome")}
    <p class="ss-muted" style="margin:0">Select an inspection domain. You can switch any time.</p>
    <div class="ss-dgrid">
      ${Object.entries(PACKS?.domains || {}).map(([id, d]) => `
        <button class="ss-dcard${id === STATE.domain ? " on" : ""}" data-domain="${id}" aria-pressed="${id === STATE.domain}">
          <i class="ti ${d.icon}" style="font-size:24px;color:var(--text-accent)"></i>
          <span style="font-weight:600">${d.label}</span>
          <span class="ss-muted" style="font-size:11px;line-height:1.35">${d.blurb}</span>
        </button>
      `).join('')}
    </div>
    <button class="ss-btn ss-pri" data-go="camera"><i class="ti ti-camera"></i> Continue to ${D().label}</button>
    ${foot()}
  `,

  camera: () => {
    const d = D();
    const areas = Object.entries(d.areas || {});
    return `
      ${hdr("New Inspection Check", "domains")}
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${areas.map(([id, a]) => `
          <button data-area="${id}" class="ss-pill" style="padding:6px 12px;font-size:12px;${id === STATE.area ? "background:var(--bg-accent);color:var(--text-accent);border-color:var(--border-accent)" : ""}">
            ${a.label}
          </button>
        `).join('')}
      </div>

      <div style="border:1.5px dashed var(--border-strong);border-radius:12px;min-height:220px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:16px;background:var(--surface-1);position:relative;overflow:hidden">
        <video id="camera-preview" style="display:none;width:100%;height:100%;object-fit:cover;position:absolute;top:0;left:0;border-radius:12px" autoplay playsinline muted></video>
        <img id="image-preview" style="display:none;width:100%;height:100%;object-fit:contain;position:absolute;top:0;left:0;border-radius:12px">
        <i class="ti ti-photo" style="font-size:44px;color:var(--text-muted)"></i>
        <div style="text-align:center">
          <div style="font-weight:500">Take a photo or upload</div>
          <div class="ss-muted" style="font-size:11px">Auto-scaled to 768px · EXIF stripped</div>
        </div>
        <div style="display:flex;gap:8px">
          <input type="file" id="file-input" accept="image/*" style="display:none">
          <button id="btn-browse" class="ss-btn" style="height:36px;font-size:12px"><i class="ti ti-upload"></i> Browse</button>
          <button id="btn-camera" class="ss-btn ss-pri" style="height:36px;font-size:12px"><i class="ti ti-camera"></i> Use Camera</button>
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:6px">
        <label for="custom-q" style="font-weight:500;font-size:12px">Ask custom yes/no question (optional):</label>
        <input type="text" id="custom-q" placeholder="${d.custom_placeholder || 'e.g. Is the door open?'}" maxlength="120">
      </div>

      <button class="ss-btn ss-pri" id="btn-run-check" style="margin-top:auto"><i class="ti ti-sparkles"></i> Run Check</button>
      ${foot()}
    `;
  },

  checking: () => `
    ${hdr("Analyzing...", "camera")}
    <div style="text-align:center;margin:40px 0">
      <div style="width:48px;height:48px;border:3px solid var(--border);border-top-color:var(--text-accent);border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 16px"></div>
      <div style="font-weight:600;font-size:16px" id="chk-status">Evaluating checklist...</div>
      <p class="ss-muted" style="font-size:12px;margin:8px 0 0">
        Jev-Omni running ~8 typed probability checks
      </p>
    </div>
    <style>@keyframes spin { 100% { transform: rotate(360deg); } }</style>
    ${foot()}
  `,

  results: () => {
    const res = STATE.lastResult;
    if (!res) return `<div class="ss-muted">No recent result.</div><button class="ss-btn" data-go="camera">Back</button>`;
    
    const answers = res.answers || {};
    return `
      ${hdr("Check Results", "camera")}
      <div style="background:var(--surface-1);border-radius:var(--radius);padding:10px 12px;display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-weight:600">${D().label} · ${A().label}</div>
          <div class="ss-muted">${res.latency_ms?.total || 1800} ms · Jev-Omni</div>
        </div>
        <span class="ss-pill" style="background:var(--bg-accent);color:var(--text-accent)">8 checks</span>
      </div>

      <div style="display:flex;flex-direction:column;gap:6px;max-height:360px;overflow-y:auto;padding-right:4px">
        ${Object.entries(answers).map(([qId, ans]) => {
          const isScore = ans.argmax !== undefined;
          const pct = isScore ? Math.round((ans.ev || 0) * 100) : Math.round((ans.p || 0) * 100);
          const valStr = isScore ? `${ans.argmax} (${pct}%)` : `${pct}%`;
          
          let fill = "var(--fill-success)";
          if (pct >= 70) fill = "var(--fill-danger)";
          else if (pct >= 40) fill = "var(--fill-warning)";

          return `
            <div class="ss-row">
              <div style="flex:1;min-width:0">
                <div style="font-weight:500;font-size:12px">${ans.question || qId.replace(/_/g, ' ')}</div>
                <div class="ss-bar">
                  <div style="height:100%;width:${pct}%;background:${fill}"></div>
                </div>
              </div>
              <span class="ss-muted" style="width:50px;text-align:right;font-size:11px">${valStr}</span>
            </div>
          `;
        }).join('')}
      </div>

      <button class="ss-btn ss-pri" data-go="camera"><i class="ti ti-camera"></i> Check Another Photo</button>
      <button class="ss-btn" data-go="shift"><i class="ti ti-history"></i> View Session & Alerts</button>
      ${foot()}
    `;
  },

  shift: () => {
    const decision = decide(STATE.snapshots, STATE.policyParams, STATE.resolvedAlerts);
    const openAlerts = decision.alerts.filter(a => a.status === 'open');

    return `
      ${hdr("Session Timeline", "welcome")}
      <div style="display:grid;grid-template-columns:repeat(3, minmax(0, 1fr));gap:6px">
        <div style="background:var(--surface-1);border-radius:var(--radius);padding:8px">
          <div class="ss-muted" style="font-size:11px">Snapshots</div>
          <div style="font-size:18px;font-weight:600">${STATE.snapshots.length}</div>
        </div>
        <div style="background:var(--surface-1);border-radius:var(--radius);padding:8px">
          <div class="ss-muted" style="font-size:11px">Decisions</div>
          <div style="font-size:18px;font-weight:600">${STATE.snapshots.length * 8}</div>
        </div>
        <div style="background:var(--surface-1);border-radius:var(--radius);padding:8px">
          <div class="ss-muted" style="font-size:11px">Active Alerts</div>
          <div style="font-size:18px;font-weight:600;color:${openAlerts.length ? 'var(--text-danger)' : 'var(--text-success)'}">
            ${openAlerts.length}
          </div>
        </div>
      </div>

      ${openAlerts.length ? openAlerts.map(a => `
        <div style="border:1px solid var(--border-danger);border-radius:var(--radius);padding:10px;background:var(--bg-danger);color:var(--text-danger)">
          <div style="display:flex;justify-content:space-between;align-items:center;font-weight:600">
            <span><i class="ti ti-alert-triangle"></i> ${a.q.replace(/_/g, ' ')} (${a.place})</span>
            <span style="font-size:11px">${Math.round(a.peak_s * 100)}%</span>
          </div>
          <p style="margin:6px 0;font-size:12px;font-family:var(--font-voice);color:var(--text-primary)">
            Incident logged for ${a.place}. Review and confirm resolution.
          </p>
          <div style="display:flex;gap:6px">
            <button class="ss-btn ss-pri" style="height:28px;font-size:11px" data-resolve="${a.id}"><i class="ti ti-check"></i> Mark Resolved</button>
          </div>
        </div>
      `).join('') : `
        <div style="background:var(--bg-success);color:var(--text-success);border-radius:var(--radius);padding:10px;display:flex;align-items:center;gap:8px">
          <i class="ti ti-circle-check" style="font-size:18px"></i>
          <span>No open alerts. All systems clear.</span>
        </div>
      `}

      <button class="ss-btn" data-go="rules"><i class="ti ti-adjustments"></i> Tune Alert Rules</button>
      <button class="ss-btn ss-pri" data-go="camera"><i class="ti ti-camera"></i> New Check</button>
      ${foot()}
    `;
  },

  rules: () => `
    ${hdr("Alert Rules & Sensitivity", "shift")}
    <div style="background:var(--bg-accent);color:var(--text-accent);border-radius:var(--radius);padding:8px 10px;font-size:12px">
      <i class="ti ti-bolt"></i> Sliders re-evaluate all past snapshots instantly in pure JS.
    </div>

    <div>
      <div style="display:flex;justify-content:space-between">
        <label for="sens-range" style="font-weight:500">Alert Sensitivity</label>
        <span class="ss-muted" id="sens-val">${STATE.sensitivity}%</span>
      </div>
      <input type="range" id="sens-range" min="0" max="100" step="5" value="${STATE.sensitivity}" style="width:100%">
      <div class="ss-muted" style="display:flex;justify-content:space-between;font-size:11px">
        <span>Fewer alerts</span>
        <span>Catch everything</span>
      </div>
    </div>

    <div>
      <div style="font-weight:500;margin-bottom:6px">Multi-Snapshot Confirmation</div>
      <div style="display:flex;gap:6px">
        ${[[1, "1 photo (single-shot)"], [2, "2 of last 3"]].map(([v, label]) => `
          <button style="flex:1;font-size:12px;${STATE.confirm === v ? "background:var(--bg-accent);color:var(--text-accent);border-color:var(--border-accent)" : ""}" data-confirm="${v}">
            ${label}
          </button>
        `).join('')}
      </div>
    </div>

    <button class="ss-btn ss-pri" data-go="shift">Apply Rules</button>
    ${foot()}
  `
};

let capturedBlob = null;

function renderNav() {
  const screens = [
    ['welcome', 'Home'],
    ['domains', 'Domains'],
    ['camera', 'Check'],
    ['shift', 'Timeline'],
    ['rules', 'Rules']
  ];
  $('ss-nav').innerHTML = screens.map(([k, label]) => `
    <button class="${STATE.screen === k ? 'on' : ''}" data-go="${k}">${label}</button>
  `).join('');
}

function navigate(screenName) {
  STATE.screen = screenName;
  renderNav();
  $('ss-scr').innerHTML = SCREENS[screenName] ? SCREENS[screenName]() : SCREENS.welcome();
  attachScreenEvents();
}

function attachScreenEvents() {
  const scr = STATE.screen;

  if (scr === 'camera') {
    const fileInput = $('file-input');
    const btnBrowse = $('btn-browse');
    const btnCamera = $('btn-camera');
    const btnRun = $('btn-run-check');
    const imgPrev = $('image-preview');
    const vidPrev = $('camera-preview');

    btnBrowse.onclick = () => fileInput.click();
    fileInput.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const res = await processImageFile(file);
      capturedBlob = res.blob;
      imgPrev.src = res.dataUrl;
      imgPrev.style.display = 'block';
      vidPrev.style.display = 'none';
      if (STATE.activeStream) STATE.activeStream.stop();
    };

    btnCamera.onclick = async () => {
      STATE.activeStream = new CameraStream(vidPrev);
      vidPrev.style.display = 'block';
      imgPrev.style.display = 'none';
      await STATE.activeStream.start();
    };

    btnRun.onclick = async () => {
      if (STATE.activeStream && vidPrev.style.display === 'block') {
        const frame = await STATE.activeStream.captureFrame();
        capturedBlob = frame?.blob;
        STATE.activeStream.stop();
      }

      if (!capturedBlob) {
        // Fallback transparent 1x1 blob if nothing selected
        const canvas = document.createElement('canvas');
        canvas.width = 100; canvas.height = 100;
        await new Promise(r => canvas.toBlob(b => { capturedBlob = b; r(); }, 'image/jpeg'));
      }

      navigate('checking');
      const customQ = $('custom-q')?.value || '';
      
      const res = await callAnalyze({
        imageBlob: capturedBlob,
        domain: STATE.domain,
        area: STATE.area,
        localTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        customQuestion: customQ
      });

      STATE.lastResult = res;

      // Add to session snapshots
      STATE.snapshots.push({
        id: `snap-${Date.now()}`,
        domain: STATE.domain,
        area: STATE.area,
        place: A().label,
        timestamp: new Date().toISOString(),
        answers: res.answers
      });

      navigate('results');
    };
  }

  if (scr === 'rules') {
    const range = $('sens-range');
    if (range) {
      range.oninput = (e) => {
        STATE.sensitivity = +e.target.value;
        $('sens-val').textContent = `${STATE.sensitivity}%`;
        // Adjust c_miss based on sensitivity
        const mult = STATE.sensitivity / 50;
        STATE.policyParams.severities.high.c_miss = 10 * mult;
        STATE.policyParams.severities.critical.c_miss = 50 * mult;
      };
    }
  }
}

document.addEventListener('click', (e) => {
  const target = e.target.closest('[data-go],[data-domain],[data-area],[data-resolve],[data-confirm]');
  if (!target) return;

  if (target.dataset.go) {
    navigate(target.dataset.go);
  } else if (target.dataset.domain) {
    STATE.domain = target.dataset.domain;
    STATE.area = Object.keys(D().areas || {})[0] || 'floor';
    navigate('camera');
  } else if (target.dataset.area) {
    STATE.area = target.dataset.area;
    navigate('camera');
  } else if (target.dataset.resolve) {
    STATE.resolvedAlerts.add(target.dataset.resolve);
    navigate('shift');
  } else if (target.dataset.confirm) {
    STATE.confirm = +target.dataset.confirm;
    STATE.policyParams.severities.high.k = STATE.confirm;
    navigate('rules');
  }
});

$('theme-toggle').onclick = () => {
  const root = document.documentElement;
  const isDark = root.dataset.theme === 'dark' || (!root.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
  root.dataset.theme = isDark ? 'light' : 'dark';
};

// Initialize
await loadPacks();
navigate('welcome');
