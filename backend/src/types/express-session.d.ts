import type { SessionUser } from '../auth/auth.types';

/**
 * Augmente le typage de la session Express avec nos champs métier.
 * `req.session.user` est alors typé partout.
 */
declare module 'express-session' {
  interface SessionData {
    /** Utilisateur Strava connecté (absent si non authentifié). */
    user?: SessionUser;
    /** Anti-CSRF : valeur aléatoire envoyée à Strava puis revérifiée au callback. */
    oauthState?: string;
  }
}
