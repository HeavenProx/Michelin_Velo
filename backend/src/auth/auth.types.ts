/**
 * Types liés à l'authentification Strava.
 * La doc OAuth Strava : https://developers.strava.com/docs/authentication
 */

/** Athlète tel que renvoyé par Strava (résumé). Champs partiels, on garde l'essentiel. */
export interface StravaAthlete {
  id: number;
  firstname: string;
  lastname: string;
  city: string | null;
  state: string | null;
  country: string | null;
  sex: string | null;
  /** URL de l'avatar (medium). */
  profile: string;
  [key: string]: unknown;
}

/** Réponse de POST /oauth/token (échange de code ou refresh). */
export interface StravaTokenResponse {
  token_type: string;
  /** Timestamp epoch (secondes) d'expiration de l'access token. */
  expires_at: number;
  expires_in: number;
  refresh_token: string;
  access_token: string;
  /** Présent uniquement lors de l'échange initial du code. */
  athlete?: StravaAthlete;
}

/** Ce qu'on stocke en session pour un utilisateur connecté. */
export interface SessionUser {
  athlete: StravaAthlete;
  accessToken: string;
  refreshToken: string;
  /** Timestamp epoch (secondes) d'expiration de l'access token. */
  expiresAt: number;
}
