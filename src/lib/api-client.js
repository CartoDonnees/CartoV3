/** Petit client fetch pour l'API v1 (enveloppe { success, data | error }). */
export async function api(url, { method = "GET", body } = {}) {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = {};
  try {
    json = await res.json();
  } catch {
    /* réponse vide */
  }
  if (!res.ok || json.success === false) {
    throw new Error(json?.error?.message || `Erreur ${res.status}`);
  }
  return json.data;
}
