/** Accès mémoïsé aux données GeoJSON/JSON servies par /api/v1/geo. */

const cache = new Map();

function get(url) {
  if (!cache.has(url)) {
    cache.set(url, fetch(url).then((r) => {
      if (!r.ok) throw new Error(`fetch ${url} → ${r.status}`);
      return r.json();
    }).catch((e) => {
      cache.delete(url);
      throw e;
    }));
  }
  return cache.get(url);
}

export const getDistricts = (date) => get(`/api/v1/geo?kind=district&date=${date}`);
export const getRegions = (date) => get(`/api/v1/geo?kind=region&date=${date}`);
export const getDepartments = (date) => get(`/api/v1/geo?kind=department&date=${date}`);
export const getSubPrefectures = (date) => get(`/api/v1/geo?kind=subPrefecture&date=${date}`);
/** Localités de la période (le nom est dans `properties.ADM4_FR`). */
export const getLocalities = (date) => get(`/api/v1/geo?kind=locality&date=${date}`);
export const getWhiteLocalities = (date = "2024-12-31") => get(`/api/v1/geo?kind=whiteLocality&date=${date}`);
export const getStats = (date) => get(`/api/v1/geo?kind=stats&date=${date}`);
/** Audits de qualité de service : mesures d'un service sur une campagne. */
export const getQos = (service, campaign) =>
  get(`/api/v1/geo?kind=qos&service=${service}&campaign=${encodeURIComponent(campaign)}`);
/** Échantillon de localités auditées d'une campagne. */
export const getQosLocalities = (campaign) =>
  get(`/api/v1/geo?kind=qosLocality&campaign=${encodeURIComponent(campaign)}`);
/** Campagnes d'audit disponibles (de la plus récente à la plus ancienne). */
export const getQosCampaigns = () => get("/api/v1/geo?kind=qosCampaigns");

export const getFiber = (op) => get(`/api/v1/geo?kind=fiber&op=${op}`);
export const getRailways = () => get(`/api/v1/geo?kind=railways`);
export const getStateBoundary = () => get(`/api/v1/geo?kind=state`);

/** Correspondance niveau administratif → loader. */
export const ADMIN_LOADERS = {
  district: getDistricts,
  region: getRegions,
  department: getDepartments,
  subPrefecture: getSubPrefectures,
};
