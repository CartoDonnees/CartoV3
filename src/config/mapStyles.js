/** Styles Mapbox partagés (carte principale + comparateur). */
export const STYLE_URLS = {
  streets: process.env.NEXT_PUBLIC_MAPBOX_STYLE || "mapbox://styles/mapbox/light-v11",
  light: "mapbox://styles/mapbox/light-v11",
  satellite: "mapbox://styles/mapbox/satellite-streets-v12",
  dark: "mapbox://styles/mapbox/dark-v11",
  white: "mapbox://styles/mapbox/light-v11",
};

/**
 * Cadrage initial de référence — celui de la carte d'accueil.
 * Le comparateur réutilise exactement les mêmes valeurs pour ouvrir sur la
 * même vue. Des bornes trop serrées forceraient Mapbox à resserrer le zoom.
 */
export const CI_CENTER = [-5.55, 7.54];
export const CI_ZOOM = 5.7;
export const CI_MIN_ZOOM = 5.2;
/**
 * Bornes de déplacement, **centrées sur le pays** : marges identiques à l'ouest
 * et à l'est, au sud et au nord (dérivées de CI_CENTER, donc centrées par
 * construction). Assez larges pour ne pas forcer Mapbox à resserrer le zoom.
 */
// Marges égales sur les deux axes : la vue conserve la même emprise une fois
// pivotée (rotation 360°), donc Mapbox n'a jamais à recadrer pour rester dedans.
const PAN_MARGIN_LNG = 14;
const PAN_MARGIN_LAT = 14;
export const CI_BOUNDS = [
  [CI_CENTER[0] - PAN_MARGIN_LNG, CI_CENTER[1] - PAN_MARGIN_LAT], // sud-ouest
  [CI_CENTER[0] + PAN_MARGIN_LNG, CI_CENTER[1] + PAN_MARGIN_LAT], // nord-est
];

/**
 * Emprise réelle du territoire ivoirien — sert à cadrer la vue sur le pays
 * (fitBounds), quelle que soit la taille de la fenêtre.
 */
export const CI_EXTENT = [
  [-8.65, 4.3], // sud-ouest
  [-2.45, 10.8], // nord-est
];
