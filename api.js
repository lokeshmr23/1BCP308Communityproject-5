const configuredBase = import.meta.env.VITE_API_URL?.replace(/\/$/, '');
const API_BASE = configuredBase || '/api';
let token = localStorage.getItem('gramsetu-token') || '';

export function setToken(value) {
  token = value || '';
  if (token) localStorage.setItem('gramsetu-token', token);
  else localStorage.removeItem('gramsetu-token');
}
export function getToken() { return token; }

export async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  let body = options.body;
  if (body && !(body instanceof FormData) && typeof body !== 'string') {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(body);
  }
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers, body });
  } catch (_error) {
    const error = new Error('Could not reach the server. The free API may be waking up; try again in a few seconds.');
    error.network = true;
    throw error;
  }
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    const error = new Error(payload?.error || `Request failed (${response.status})`);
    error.status = response.status;
    error.details = payload?.details || [];
    throw error;
  }
  return payload;
}

export async function downloadSampleCsv() {
  const response = await fetch('/secondary-grievance-sample.csv');
  if (!response.ok) throw new Error('CSV template is unavailable.');
  return response.blob();
}
