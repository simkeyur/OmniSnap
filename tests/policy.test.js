import test from 'node:test';
import assert from 'node:assert';
import { decide, computeTau, classifyBand, DEFAULT_PARAMS } from '../web/policy.js';

test('Tau calculation and floor', () => {
  // critical: c_miss=50, c_false=1 -> 1/51 ≈ 0.0196, floor=0.30 -> should be 0.30
  const tauCrit = computeTau(50, 1, 0.30);
  assert.strictEqual(tauCrit, 0.30);

  // custom without floor: c_miss=4, c_false=1 -> 1/5 = 0.20
  const tauCustom = computeTau(4, 1, 0);
  assert.strictEqual(tauCustom, 0.20);
});

test('Classification bands with margin', () => {
  const tau = 0.50;
  const margin = 0.1;
  assert.strictEqual(classifyBand(0.65, tau, margin), 'act');
  assert.strictEqual(classifyBand(0.55, tau, margin), 'check');
  assert.strictEqual(classifyBand(0.42, tau, margin), 'check');
  assert.strictEqual(classifyBand(0.35, tau, margin), 'clear');
});

test('Vector 1: Single critical snapshot opens an alert immediately', () => {
  const snapshots = [
    {
      id: 'snap-1',
      domain: 'store',
      place: 'Aisle 3',
      timestamp: '2026-09-24T12:00:00Z',
      answers: {
        person_down: { signal: 0.85, severity: 'critical' }
      }
    }
  ];

  const res = decide(snapshots);
  assert.strictEqual(res.alerts.length, 1);
  assert.strictEqual(res.alerts[0].status, 'open');
  assert.strictEqual(res.alerts[0].q, 'person_down');
});

test('Vector 2: Single high snapshot -> needs_confirmation, second opens alert', () => {
  const snap1 = {
    id: 'snap-1',
    domain: 'store',
    place: 'Aisle 4',
    timestamp: '2026-09-24T12:00:00Z',
    answers: {
      spill: { signal: 0.80, severity: 'high' }
    }
  };

  const res1 = decide([snap1]);
  assert.strictEqual(res1.alerts.length, 1);
  assert.strictEqual(res1.alerts[0].status, 'needs_confirmation');
  assert.strictEqual(res1.alerts[0].hits, 1);

  const snap2 = {
    id: 'snap-2',
    domain: 'store',
    place: 'Aisle 4',
    timestamp: '2026-09-24T12:05:00Z',
    answers: {
      spill: { signal: 0.85, severity: 'high' }
    }
  };

  const res2 = decide([snap1, snap2]);
  assert.strictEqual(res2.alerts.length, 1);
  assert.strictEqual(res2.alerts[0].status, 'open');
});

test('Vector 3: Snapshots of different places do not fuse', () => {
  const snapAisle1 = {
    id: 'snap-1',
    domain: 'store',
    place: 'Aisle 1',
    timestamp: '2026-09-24T12:00:00Z',
    answers: {
      spill: { signal: 0.80, severity: 'high' }
    }
  };

  const snapAisle2 = {
    id: 'snap-2',
    domain: 'store',
    place: 'Aisle 2',
    timestamp: '2026-09-24T12:05:00Z',
    answers: {
      spill: { signal: 0.80, severity: 'high' }
    }
  };

  const res = decide([snapAisle1, snapAisle2]);
  // Both need confirmation, neither should fuse to "open"
  assert.strictEqual(res.alerts.length, 2);
  assert.ok(res.alerts.every(a => a.status === 'needs_confirmation'));
});

test('Vector 4: Attendant budget queues lowest-cost alerts', () => {
  const snapshots = [
    {
      id: 'snap-crit',
      domain: 'store',
      place: 'Front',
      timestamp: '2026-09-24T12:00:00Z',
      answers: {
        person_down: { signal: 0.90, severity: 'critical' } // priority 0.90 * 50 = 45
      }
    },
    {
      id: 'snap-low',
      domain: 'store',
      place: 'Back',
      timestamp: '2026-09-24T12:01:00Z',
      answers: {
        empty_shelf: { signal: 0.90, severity: 'low' } // low severity k=1 override for test
      }
    }
  ];

  const params = {
    ...DEFAULT_PARAMS,
    max_open_alerts: 1,
    severities: {
      ...DEFAULT_PARAMS.severities,
      low: { c_miss: 1, c_false: 1, floor: 0.5, k: 1, n: 1 }
    }
  };

  const res = decide(snapshots, params);
  assert.strictEqual(res.alerts.length, 2);
  const openAlert = res.alerts.find(a => a.status === 'open');
  const queuedAlert = res.alerts.find(a => a.status === 'queued');

  assert.strictEqual(openAlert.q, 'person_down');
  assert.strictEqual(queuedAlert.q, 'empty_shelf');
});

test('Vector 5: Resolved alert is suppressed', () => {
  const snap = {
    id: 'snap-1',
    domain: 'store',
    place: 'Aisle 3',
    timestamp: '2026-09-24T12:00:00Z',
    answers: {
      person_down: { signal: 0.85, severity: 'critical' }
    }
  };

  const alertId = 'store::Aisle 3::person_down';
  const res = decide([snap], DEFAULT_PARAMS, new Set([alertId]));
  assert.strictEqual(res.alerts.length, 0);
});
