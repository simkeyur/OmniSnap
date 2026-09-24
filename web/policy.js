/**
 * OmniSnap Client-side Policy Engine
 * Pure functions: calculates cost-sensitive thresholds, confidence bands,
 * multi-snapshot place stream fusion, and alert states.
 */

export const DEFAULT_PARAMS = {
  margin: 0.1,
  max_open_alerts: 10,
  severities: {
    critical: { c_miss: 50, c_false: 1, floor: 0.30, k: 1, n: 1 },
    high:     { c_miss: 10, c_false: 1, floor: 0.40, k: 2, n: 3 },
    medium:   { c_miss: 4,  c_false: 1, floor: 0.50, k: 2, n: 3 },
    low:      { c_miss: 1,  c_false: 1, floor: 0.65, k: 2, n: 3 }
  }
};

/**
 * Computes cost-sensitive threshold tau for a given severity configuration
 */
export function computeTau(c_miss, c_false, floor = 0) {
  const theoretical = c_false / (c_false + c_miss);
  return Math.max(floor, theoretical);
}

/**
 * Returns band: "act" | "check" | "clear"
 */
export function classifyBand(signal, tau, margin = 0.1) {
  if (signal >= tau + margin) return "act";
  if (signal >= tau - margin) return "check";
  return "clear";
}

/**
 * Core decision function
 * @param {Array} snapshots - list of snapshots [{id, domain, area, place, timestamp, answers: {[qId]: {signal, severity}}}]
 * @param {Object} params - custom or DEFAULT_PARAMS
 * @param {Set|Array} resolvedAlertIds - IDs of resolved alerts
 */
export function decide(snapshots = [], params = DEFAULT_PARAMS, resolvedAlertIds = new Set()) {
  const resolvedSet = resolvedAlertIds instanceof Set ? resolvedAlertIds : new Set(resolvedAlertIds);
  const margin = params.margin ?? 0.1;
  const severities = params.severities || DEFAULT_PARAMS.severities;
  const maxOpen = params.max_open_alerts || 10;

  const perSnapshot = [];
  let counts = { act: 0, check: 0, clear: 0 };

  // Place streams: key = `${domain}::${place || area}`
  // mapped to history of snapshots
  const placeStreams = new Map();

  for (const snap of snapshots) {
    const streamKey = `${snap.domain}::${snap.place || snap.area}`;
    if (!placeStreams.has(streamKey)) {
      placeStreams.set(streamKey, []);
    }
    placeStreams.get(streamKey).push(snap);

    const snapResults = {};
    for (const [qId, qData] of Object.entries(snap.answers || {})) {
      const sev = qData.severity;
      const sevConfig = severities[sev] || severities.medium;
      const tau = computeTau(sevConfig.c_miss, sevConfig.c_false, sevConfig.floor);
      const band = classifyBand(qData.signal, tau, margin);

      counts[band]++;
      snapResults[qId] = {
        signal: qData.signal,
        severity: sev,
        tau,
        band
      };
    }

    perSnapshot.push({
      id: snap.id,
      domain: snap.domain,
      place: snap.place || snap.area,
      timestamp: snap.timestamp,
      results: snapResults
    });
  }

  // Multi-snapshot fusion per place stream & question
  const openAlerts = [];

  for (const [streamKey, streamSnaps] of placeStreams.entries()) {
    const [domain, place] = streamKey.split('::');

    // Aggregate questions evaluated across this stream
    const questionKeys = new Set();
    streamSnaps.forEach(s => Object.keys(s.answers || {}).forEach(k => questionKeys.add(k)));

    for (const qId of questionKeys) {
      // Find snapshots in stream containing this question
      const qSnaps = streamSnaps.filter(s => s.answers && s.answers[qId] && s.answers[qId].severity);
      if (qSnaps.length === 0) continue;

      const latestSnap = qSnaps[qSnaps.length - 1];
      const qAns = latestSnap.answers[qId];
      const sev = qAns.severity;
      const sevConfig = severities[sev] || severities.medium;
      const tau = computeTau(sevConfig.c_miss, sevConfig.c_false, sevConfig.floor);
      const { k, n } = sevConfig;

      // Look at last n snapshots
      const windowSnaps = qSnaps.slice(-n);
      const qualifyingSnaps = windowSnaps.filter(s => s.answers[qId].signal >= tau);
      const hits = qualifyingSnaps.length;

      const alertId = `${streamKey}::${qId}`;
      const isResolved = resolvedSet.has(alertId);

      // Check peak signal in window
      const peak_s = Math.max(...windowSnaps.map(s => s.answers[qId].signal));
      const latestBand = classifyBand(qAns.signal, tau, margin);

      if (hits >= k && latestBand !== "clear") {
        if (!isResolved) {
          openAlerts.push({
            id: alertId,
            q: qId,
            domain,
            place,
            severity: sev,
            opened_at: qualifyingSnaps[0].timestamp,
            latest_at: latestSnap.timestamp,
            snapshot_ids: qualifyingSnaps.map(s => s.id),
            peak_s,
            priority_score: peak_s * sevConfig.c_miss,
            status: "open"
          });
        }
      } else if (hits > 0 && hits < k && latestBand === "act") {
        if (!isResolved) {
          openAlerts.push({
            id: alertId,
            q: qId,
            domain,
            place,
            severity: sev,
            opened_at: qualifyingSnaps[0].timestamp,
            latest_at: latestSnap.timestamp,
            snapshot_ids: qualifyingSnaps.map(s => s.id),
            peak_s,
            priority_score: peak_s * sevConfig.c_miss,
            status: "needs_confirmation",
            hits,
            k
          });
        }
      }
    }
  }

  // Attendant budget: if open alerts exceed maxOpen, rank by priority_score and queue the rest
  const trulyOpen = openAlerts.filter(a => a.status === "open");
  if (trulyOpen.length > maxOpen) {
    trulyOpen.sort((a, b) => b.priority_score - a.priority_score);
    const keep = new Set(trulyOpen.slice(0, maxOpen).map(a => a.id));
    openAlerts.forEach(a => {
      if (a.status === "open" && !keep.has(a.id)) {
        a.status = "queued";
      }
    });
  }

  return {
    perSnapshot,
    alerts: openAlerts,
    counts
  };
}
