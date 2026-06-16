/**
 * Augmente le typage de la session Express.
 * La session ne stocke qu'une référence légère ; les données complètes
 * sont chargées depuis la base par le guard.
 */

// export {} rend ce fichier "module" → declare module fonctionne comme augmentation
export {};

declare module 'express-session' {
  interface SessionData {
    /** Strava athlete ID de l'utilisateur connecté (absent si non authentifié). */
    stravaId?: number;
    /** Anti-CSRF : valeur aléatoire envoyée à Strava puis revérifiée au callback. */
    oauthState?: string;
  }
}
