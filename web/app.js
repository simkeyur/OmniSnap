import { decide, DEFAULT_PARAMS } from './policy.js';
import { processImageFile, CameraStream } from './capture.js';
import { callAnalyze } from './live.js';

let PACKS = null;

// Application State
const STATE = {
  screen: 'welcome',
  domain: 'store',
  area: 'floor',
  snapshots: [],
  resolvedAlerts: new Set(),
  policyParams: JSON.parse(JSON.stringify(DEFAULT_PARAMS)),
  sensitivity: 50,
  confirm: 2,
  lastResult: null,
  activeStream: null,
  facingMode: 'environment',
  capturedBase64: null,
  errorMessage: null
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
      ${back ? `<button aria-label="Back" data-go="${back}" style="height:30px;padding:0 8px"><i class="ti ti-arrow-left"></i></button>` : '<i class="ti ti-shield-check" style="font-size:22px;color:var(--text-accent)"></i>'}
      <span style="font-weight:600;font-size:15px">${title}</span>
    </div>
    <button data-go="domains" style="height:28px;font-size:11px;padding:0 10px;border-radius:var(--radius);background:var(--surface-1);color:var(--text-secondary);border:none">
      <i class="ti ${D().icon || 'ti-building-store'}"></i> ${D().label || 'Store'}
    </button>
  </div>
`;

const foot = () => `
  <p class="ss-muted" style="margin-top:auto;font-size:11px;text-align:center;padding-top:10px">
    ${D().disclaimer || 'Demo only, not a safety system'}
  </p>
`;

const SCREENS = {
  welcome: () => `
    <div style="text-align:center;margin-top:20px">
      <div style="width:64px;height:64px;border-radius:50%;background:var(--bg-accent);color:var(--text-accent);display:flex;align-items:center;justify-content:center;margin:0 auto 12px;font-size:32px">
        <i class="ti ti-shield-check"></i>
      </div>
      <p style="font-size:20px;font-weight:600;margin:0 0 6px">OmniSnap</p>
      <p class="ss-muted" style="font-size:13px;line-height:1.4">
        A second pair of eyes for your shift, home, or fleet. Fast visual checks powered by open Jev-style decision models.
      </p>
    </div>

    <div style="display:flex;flex-direction:column;gap:12px;margin:20px 0">
      ${[
        ['ti-lock', 'Privacy by design', 'Photos downscaled to 768px, EXIF stripped, and never stored.'],
        ['ti-gauge', 'Calibrated probabilities', 'Direct likelihood numbers for each safety question.'],
        ['ti-bolt', 'Instant policy sliders', 'Adjust thresholds with zero extra model queries.']
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
    <button class="ss-btn" data-go="shift"><i class="ti ti-history"></i> View Session (${STATE.snapshots.length} checks)</button>
    ${foot()}
  `,

  domains: () => `
    ${hdr("Select Inspection Domain", "welcome")}
    <p class="ss-muted" style="margin:0">Choose what you are checking. You can change this anytime.</p>
    <div class="ss-dgrid">
      ${Object.entries(PACKS?.domains || {}).map(([id, d]) => `
        <button class="ss-dcard${id === STATE.domain ? " on" : ""}" data-domain="${id}" aria-pressed="${id === STATE.domain}">
          <i class="ti ${d.icon}" style="font-size:24px;color:var(--text-accent)"></i>
          <span style="font-weight:600">${d.label}</span>
          <span class="ss-muted" style="font-size:11px;line-height:1.35">${d.blurb}</span>
        </button>
      `).join('')}
    </div>
    <button class="ss-btn ss-pri" data-go="camera"><i class="ti ti-camera"></i> Continue with ${D().label}</button>
    ${foot()}
  `,

  camera: () => {
    const d = D();
    const areas = Object.entries(d.areas || {});
    const hasPhoto = !!STATE.capturedBase64;

    return `
      ${hdr("Check: " + d.label, "domains")}
      
      <!-- Area selector chips -->
      <div>
        <div class="ss-muted" style="font-size:11px;margin-bottom:4px">Select Area:</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${areas.map(([id, a]) => `
            <button data-area="${id}" class="ss-pill" style="padding:6px 12px;font-size:12px;${id === STATE.area ? "background:var(--bg-accent);color:var(--text-accent);border-color:var(--border-accent)" : ""}">
              ${a.label}
            </button>
          `).join('')}
        </div>
      </div>

      <!-- Viewfinder / Photo Area -->
      <div class="viewfinder-box" id="viewfinder">
        <video id="camera-video" class="viewfinder-video" style="display:none" autoplay playsinline muted></video>
        <img id="camera-img" class="viewfinder-img" style="${hasPhoto ? '' : 'display:none'}" src="${STATE.capturedBase64 || ''}">
        <div class="flash-overlay" id="flash-overlay"></div>

        <!-- Top controls when video is running -->
        <div class="viewfinder-top-bar" id="viewfinder-top" style="display:none">
          <button class="viewfinder-icon-btn" id="btn-close-stream" aria-label="Close Camera"><i class="ti ti-x"></i></button>
          <button class="viewfinder-icon-btn" id="btn-flip-stream" aria-label="Flip Camera"><i class="ti ti-camera-rotate"></i></button>
        </div>

        <!-- Floating Shutter button over video -->
        <div class="shutter-container" id="shutter-box" style="display:none">
          <button class="shutter-btn" id="btn-shutter" aria-label="Snap Photo">
            <div class="shutter-inner"></div>
          </button>
        </div>

        <!-- Placeholder when no photo and camera inactive -->
        <div id="viewfinder-placeholder" style="${hasPhoto ? 'display:none;' : ''}display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:#fff;text-align:center;padding:20px">
          <i class="ti ti-camera" style="font-size:42px;opacity:0.8"></i>
          <span style="font-weight:500;font-size:14px">Ready to check ${A().label || 'area'}</span>
          <span style="font-size:11px;opacity:0.7">Snap a photo or open live camera</span>
        </div>
      </div>

      <!-- Action buttons -->
      <div style="display:flex;flex-direction:column;gap:8px">
        ${hasPhoto ? `
          <div style="display:flex;gap:8px">
            <button id="btn-retake" class="ss-btn" style="flex:1"><i class="ti ti-rotate"></i> Retake</button>
            <button id="btn-run-check" class="ss-btn ss-pri" style="flex:2"><i class="ti ti-sparkles"></i> Run Check</button>
          </div>
        ` : `
          <div style="display:flex;gap:8px">
            <!-- Native phone camera input: launches camera app on iOS/Android -->
            <input type="file" id="native-cam-input" accept="image/*" capture="environment" style="display:none">
            <button id="btn-native-cam" class="ss-btn ss-pri" style="flex:1"><i class="ti ti-camera"></i> Camera</button>
            
            <!-- Live in-browser stream -->
            <button id="btn-start-stream" class="ss-btn" style="flex:1"><i class="ti ti-video"></i> Live Stream</button>

            <!-- File browse -->
            <input type="file" id="file-browse-input" accept="image/*" style="display:none">
            <button id="btn-browse-file" class="ss-btn" style="width:48px;padding:0" aria-label="Upload from files"><i class="ti ti-photo"></i></button>
          </div>
        `}
      </div>

      <!-- Custom question toggle -->
      <div style="display:flex;flex-direction:column;gap:4px">
        <label for="custom-q" class="ss-muted" style="font-size:11px">Optional custom question (Yes/No):</label>
        <input type="text" id="custom-q" placeholder="${d.custom_placeholder || 'e.g. Is the freezer closed?'}" maxlength="120">
      </div>

      ${foot()}
    `;
  },

  checking: () => `
    ${hdr("Analyzing Photo", "camera")}
    <div style="text-align:center;margin:50px 0">
      <div style="width:52px;height:52px;border:3.5px solid var(--border);border-top-color:var(--text-accent);border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 16px"></div>
      <div style="font-weight:600;font-size:16px">Calling Jev-Omni Model...</div>
      <p class="ss-muted" style="font-size:12px;margin:8px 0 0">
        Evaluating ~8 typed safety questions on Hugging Face ZeroGPU
      </p>
    </div>
    <style>@keyframes spin { 100% { transform: rotate(360deg); } }</style>
    ${foot()}
  `,

  error: () => `
    ${hdr("Check Failed", "camera")}
    <div style="background:var(--bg-danger);color:var(--text-danger);border-radius:var(--radius);padding:14px;margin:20px 0;display:flex;flex-direction:column;gap:6px">
      <div style="font-weight:600;display:flex;align-items:center;gap:6px">
        <i class="ti ti-alert-triangle"></i> Inference Error
      </div>
      <div style="font-size:12px;line-height:1.4">${STATE.errorMessage || 'Unable to complete model evaluation.'}</div>
    </div>
    <button class="ss-btn ss-pri" data-go="camera"><i class="ti ti-rotate"></i> Try Again</button>
    ${foot()}
  `,

  results: () => {
    const res = STATE.lastResult;
    if (!res) return `<div class="ss-muted">No result found.</div><button class="ss-btn" data-go="camera">Back</button>`;
    
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
          if (pct >= 65) fill = "var(--fill-danger)";
          else if (pct >= 35) fill = "var(--fill-warning)";

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
      <button class="ss-btn" data-go="shift"><i class="ti ti-history"></i> View Session Timeline</button>
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
          <div class="ss-muted" style="font-size:11px">Alerts</div>
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
            Incident flagged at ${a.place}. Review and confirm resolution.
          </p>
          <div style="display:flex;gap:6px">
            <button class="ss-btn ss-pri" style="height:28px;font-size:11px" data-resolve="${a.id}"><i class="ti ti-check"></i> Mark Resolved</button>
          </div>
        </div>
      `).join('') : `
        <div style="background:var(--bg-success);color:var(--text-success);border-radius:var(--radius);padding:10px;display:flex;align-items:center;gap:8px">
          <i class="ti ti-circle-check" style="font-size:18px"></i>
          <span>No open alerts. All checks clear.</span>
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
  if (STATE.activeStream) {
    STATE.activeStream.stop();
    STATE.activeStream = null;
  }
  STATE.screen = screenName;
  renderNav();
  $('ss-scr').innerHTML = SCREENS[screenName] ? SCREENS[screenName]() : SCREENS.welcome();
  attachScreenEvents();
}

function triggerFlash() {
  const flash = $('flash-overlay');
  if (flash) {
    flash.classList.remove('flash-active');
    void flash.offsetWidth; // trigger reflow
    flash.classList.add('flash-active');
  }
}

function attachScreenEvents() {
  const scr = STATE.screen;

  if (scr === 'camera') {
    const nativeInput = $('native-cam-input');
    const browseInput = $('file-browse-input');
    const btnNative = $('btn-native-cam');
    const btnBrowse = $('btn-browse-file');
    const btnStartStream = $('btn-start-stream');
    const btnShutter = $('btn-shutter');
    const btnCloseStream = $('btn-close-stream');
    const btnFlipStream = $('btn-flip-stream');
    const btnRetake = $('btn-retake');
    const btnRunCheck = $('btn-run-check');

    const videoEl = $('camera-video');
    const imgEl = $('camera-img');
    const topBar = $('viewfinder-top');
    const shutterBox = $('shutter-box');
    const placeholder = $('viewfinder-placeholder');

    const handleFile = async (file) => {
      if (!file) return;
      const res = await processImageFile(file);
      STATE.capturedBase64 = res.dataUrl;
      navigate('camera');
    };

    if (btnNative) {
      btnNative.onclick = () => nativeInput.click();
      nativeInput.onchange = (e) => handleFile(e.target.files[0]);
    }

    if (btnBrowse) {
      btnBrowse.onclick = () => browseInput.click();
      browseInput.onchange = (e) => handleFile(e.target.files[0]);
    }

    if (btnStartStream) {
      btnStartStream.onclick = async () => {
        STATE.activeStream = new CameraStream(videoEl);
        const ok = await STATE.activeStream.start(STATE.facingMode);
        if (ok) {
          videoEl.style.display = 'block';
          imgEl.style.display = 'none';
          if (placeholder) placeholder.style.display = 'none';
          topBar.style.display = 'flex';
          shutterBox.style.display = 'flex';
        } else {
          alert("Could not access camera. Please check camera permissions or use 'Upload Photo'.");
        }
      };
    }

    if (btnShutter) {
      btnShutter.onclick = async () => {
        if (!STATE.activeStream) return;
        triggerFlash();
        const frame = await STATE.activeStream.captureFrame();
        if (frame && frame.dataUrl) {
          STATE.capturedBase64 = frame.dataUrl;
          STATE.activeStream.stop();
          STATE.activeStream = null;
          setTimeout(() => navigate('camera'), 200);
        }
      };
    }

    if (btnCloseStream) {
      btnCloseStream.onclick = () => {
        if (STATE.activeStream) STATE.activeStream.stop();
        STATE.activeStream = null;
        navigate('camera');
      };
    }

    if (btnFlipStream) {
      btnFlipStream.onclick = async () => {
        STATE.facingMode = STATE.facingMode === 'environment' ? 'user' : 'environment';
        if (STATE.activeStream) {
          await STATE.activeStream.start(STATE.facingMode);
        }
      };
    }

    if (btnRetake) {
      btnRetake.onclick = () => {
        STATE.capturedBase64 = null;
        navigate('camera');
      };
    }

    if (btnRunCheck) {
      btnRunCheck.onclick = async () => {
        if (!STATE.capturedBase64) return;
        const customQ = $('custom-q')?.value || '';
        const b64Data = STATE.capturedBase64;

        navigate('checking');

        try {
          const res = await callAnalyze({
            imageBase64: b64Data,
            domain: STATE.domain,
            area: STATE.area,
            localTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            customQuestion: customQ
          });

          STATE.lastResult = res;

          // Record in session
          STATE.snapshots.push({
            id: `snap-${Date.now()}`,
            domain: STATE.domain,
            area: STATE.area,
            place: A().label,
            timestamp: new Date().toISOString(),
            answers: res.answers
          });

          navigate('results');
        } catch (err) {
          STATE.errorMessage = err.message || "Failed to analyze image.";
          navigate('error');
        }
      };
    }
  }

  if (scr === 'rules') {
    const range = $('sens-range');
    if (range) {
      range.oninput = (e) => {
        STATE.sensitivity = +e.target.value;
        $('sens-val').textContent = `${STATE.sensitivity}%`;
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
