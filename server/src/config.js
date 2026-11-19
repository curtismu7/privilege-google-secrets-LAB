// Deployment configuration: the Mock/Real toggle (rule 19). Mock is the only fully-offline mode and the default.
// Real mode in this lab changes nothing external: the lab contacts no Hubs gateway, no custodian and no Google
// Secret Manager (the netguard refuses every non-loopback socket). Real is therefore available only when the lab's
// own PGS_MODE_REAL=1 is set, and even then the page keeps saying everything is simulated.
export function realAvailableFrom(env = process.env) { return env.PGS_MODE_REAL === '1'; }

export function realProblemFrom(env = process.env) {
  return 'This lab has no live mode: it contacts no Privilege Hubs gateway and no Google Secret Manager. Set PGS_MODE_REAL=1 only to enable the real settings form against this lab\'s own state. Mock keeps working.';
}

// The launch mode. Default: Real if enabled, else Mock. The runtime mode (POST /api/mode) starts from this.
export function modeFrom(env = process.env) {
  if (env.MODE === undefined || env.MODE === '') return realAvailableFrom(env) ? 'real' : 'mock';
  const m = env.MODE;
  if (m !== 'mock' && m !== 'real') throw new Error(`MODE=${String(m).slice(0, 20)} is not available: this app has mock and real modes`);
  if (m === 'real' && !realAvailableFrom(env)) throw new Error('MODE=real requested but PGS_MODE_REAL=1 is not set');
  return m;
}
