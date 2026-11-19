// The rule-19 Real mode data: the owner's actual Privilege Secrets Hub tenant state, a redacted
// console-API export snapshot (no credentials — names, ids, dates, emails, GCP resource paths only).
// Mock mode serves the same snapshot object so the endpoint shape is constant; the UI decides what to
// render per mode. A missing or malformed file falls back to a shape-valid empty snapshot, never a crash.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.resolve(HERE, '../data/hub-snapshot.json');

const empty = () => ({ hub: null, secrets: [], grant: null, snapshotDate: null });

export function loadHubSnapshot(read = (f) => fs.readFileSync(f, 'utf8'), file = FILE) {
  try {
    const parsed = JSON.parse(read(file));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return empty();
    return {
      hub: parsed.hub ?? null,
      secrets: Array.isArray(parsed.secrets) ? parsed.secrets : [],
      grant: parsed.grant ?? null,
      snapshotDate: typeof parsed.snapshotDate === 'string' ? parsed.snapshotDate : null,
    };
  } catch {
    return empty();
  }
}
