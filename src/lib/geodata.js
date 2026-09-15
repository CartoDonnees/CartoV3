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
/**
 * Localités non desservies par au moins un opérateur, avec leur masque de
 * couverture : c'est la source du filtre par opérateur des zones blanches.
 * Avec les trois opérateurs retenus, on retrouve exactement `whiteLocality`.
 */
export const getWhiteLocalityOps = (date) => get(`/api/v1/geo?kind=whiteLocalityOps&date=${date}`);
export const getStats = (date) => get(`/api/v1/geo?kind=stats&date=${date}`);
/** Audits de qualité de service : mesures d'un service sur une campagne. */
export const getQos = (service, campaign) =>
  get(`/api/v1/geo?kind=qos&service=${service}&campaign=${encodeURIComponent(campaign)}`);
/** Échantillon de localités auditées d'une campagne. */
export const getQosLocalities = (campaign) =>
  get(`/api/v1/geo?kind=qosLocality&campaign=${encodeURIComponent(campaign)}`);
/** Campagnes d'audit disponibles (de la plus récente à la plus ancienne). */
export const getQosCampaigns = () => get("/api/v1/geo?kind=qosCampaigns");

/**
 * Sites 2G/3G/4G géolocalisés, extraits des jeux de tuiles ARTCI.
 * Non datés : ils décrivent l'implantation physique, pas une période.
 */
export const getStations = () => get("/api/v1/geo?kind=stations");

/**
 * Localités équipées d'au moins une station, avec leur décompte par opérateur
 * et par technologie. Index compact extrait du fichier des localités (79 Mo),
 * qui serait inexploitable tel quel dans un tableau de bord.
 */
export const getStationIndex = (date) => get(`/api/v1/geo?kind=stationIndex&date=${date}`);

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
