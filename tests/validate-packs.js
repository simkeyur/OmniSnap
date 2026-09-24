import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packsPath = path.resolve(__dirname, '../shared/question-packs.json');
const raw = fs.readFileSync(packsPath, 'utf8');
const data = JSON.parse(raw);

assert(data.domains, "question-packs.json must contain 'domains'");
const expectedDomains = ["store", "home", "kitchen", "garden", "rental", "vehicle"];

for (const dId of expectedDomains) {
  const d = data.domains[dId];
  assert(d, `Missing domain: ${dId}`);
  assert(d.label, `Domain ${dId} missing label`);
  assert(d.icon, `Domain ${dId} missing icon`);
  assert(d.state_template, `Domain ${dId} missing state_template`);
  assert(d.areas, `Domain ${dId} missing areas`);

  for (const [aId, a] of Object.entries(d.areas)) {
    assert(a.label, `Domain ${dId} area ${aId} missing label`);
    assert(Array.isArray(a.questions), `Domain ${dId} area ${aId} questions must be an array`);
    assert(a.questions.length > 0, `Domain ${dId} area ${aId} must have at least 1 question`);
    assert(a.questions.length <= 8, `Domain ${dId} area ${aId} has ${a.questions.length} questions (> 8 quota limit)`);

    for (const q of a.questions) {
      assert(q.id, `Question in ${dId}.${aId} missing id`);
      assert(q.question, `Question ${q.id} in ${dId}.${aId} missing text`);
      assert(["noul", "score", "choice"].includes(q.type), `Question ${q.id} has invalid type ${q.type}`);
      if (q.type === "score" || q.type === "choice") {
        assert(Array.isArray(q.options) && q.options.length >= 2, `Question ${q.id} of type ${q.type} must have options array`);
      }
      if (q.severity !== null && q.severity !== undefined) {
        assert(["critical", "high", "medium", "low"].includes(q.severity), `Invalid severity ${q.severity} for question ${q.id}`);
      }
    }
  }
}

console.log("✓ question-packs.json passed all structural and quota checks.");
