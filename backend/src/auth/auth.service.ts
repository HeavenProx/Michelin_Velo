import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SessionUser, StravaTokenResponse } from './auth.types';

const STRAVA_AUTHORIZE_URL = 'https://www.strava.com/oauth/authorize';
const STRAVA_TOKEN_URL = 'https://www.strava.com/api/v3/oauth/token';

/** Scopes demandés : profil de base + lecture de TOUTES les activités (y compris "Only Me"). */
const STRAVA_SCOPES = ['read', 'activity:read_all'] as const;

/** Marge avant expiration (s) en-dessous de laquelle on rafraîchit le token de façon préventive. */
const TOKEN_REFRESH_MARGIN_S = 60;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly config: ConfigService) {
    if (!this.clientId || !this.clientSecret) {
      this.logger.warn(
        "STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET absents de .env — l'OAuth Strava échouera tant qu'ils ne sont pas renseignés (le reste de l'API fonctionne).",
      );
    }
  }

  private get clientId(): string {
    return this.config.get<string>('STRAVA_CLIENT_ID') ?? '';
  }

  private get clientSecret(): string {
    return this.config.get<string>('STRAVA_CLIENT_SECRET') ?? '';
  }

  private get callbackUrl(): string {
    return (
      this.config.get<string>('STRAVA_CALLBACK_URL') ??
      'http://localhost:3001/auth/callback'
    );
  }

  /** Construit l'URL d'autorisation Strava vers laquelle rediriger l'utilisateur. */
  buildAuthorizeUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.callbackUrl,
      response_type: 'code',
      // 'force' : Strava réaffiche toujours l'écran d'autorisation, même si
      // l'app est déjà autorisée. Sinon l'aller-retour OAuth est invisible
      // (redirection instantanée) et on a l'impression de ne pas passer par Strava.
      approval_prompt: 'force',
      scope: STRAVA_SCOPES.join(','),
      state,
    });
    return `${STRAVA_AUTHORIZE_URL}?${params.toString()}`;
  }

  /** Échange le `code` reçu au callback contre des tokens + l'athlète. */
  async exchangeCodeForToken(code: string): Promise<SessionUser> {
    const data = await this.postToken({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code,
      grant_type: 'authorization_code',
    });

    if (!data.athlete) {
      throw new UnauthorizedException(
        "Réponse Strava inattendue : athlète manquant lors de l'échange du code.",
      );
    }

    return {
      athlete: data.athlete,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_at,
    };
  }

  /**
   * Renvoie un access token valide pour l'utilisateur en session, en le
   * rafraîchissant via le refresh token s'il est expiré (ou sur le point de l'être).
   * Met à jour l'objet `user` en place (donc la session si on le persiste ensuite).
   */
  async getValidAccessToken(user: SessionUser): Promise<string> {
    const nowS = Math.floor(Date.now() / 1000);
    if (user.expiresAt - nowS > TOKEN_REFRESH_MARGIN_S) {
      return user.accessToken;
    }

    this.logger.debug('Access token Strava expiré, rafraîchissement…');
    const data = await this.postToken({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: user.refreshToken,
    });

    user.accessToken = data.access_token;
    user.refreshToken = data.refresh_token;
    user.expiresAt = data.expires_at;
    return user.accessToken;
  }

  /** Appel bas niveau de POST /oauth/token. */
  private async postToken(
    body: Record<string, string>,
  ): Promise<StravaTokenResponse> {
    const res = await fetch(STRAVA_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(body).toString(),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      this.logger.error(
        `POST /oauth/token a échoué (${res.status}): ${detail}`,
      );
      throw new UnauthorizedException(
        `Échec de l'authentification Strava (HTTP ${res.status}).`,
      );
    }

    return (await res.json()) as StravaTokenResponse;
  }
}
