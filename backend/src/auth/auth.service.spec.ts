import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import type { SessionUser } from './auth.types';

function makeConfig(values: Record<string, string>): ConfigService {
  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService;
}

const ENV = {
  STRAVA_CLIENT_ID: '12345',
  STRAVA_CLIENT_SECRET: 'secret',
  STRAVA_CALLBACK_URL: 'http://localhost:3001/auth/callback',
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    service = new AuthService(makeConfig(ENV));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('buildAuthorizeUrl', () => {
    it('cible /oauth/authorize avec les bons paramètres et scopes', () => {
      const url = new URL(service.buildAuthorizeUrl('state-abc'));

      expect(url.origin + url.pathname).toBe(
        'https://www.strava.com/oauth/authorize',
      );
      expect(url.searchParams.get('client_id')).toBe('12345');
      expect(url.searchParams.get('redirect_uri')).toBe(
        ENV.STRAVA_CALLBACK_URL,
      );
      expect(url.searchParams.get('response_type')).toBe('code');
      expect(url.searchParams.get('scope')).toBe('read,activity:read_all');
      expect(url.searchParams.get('state')).toBe('state-abc');
    });
  });

  describe('exchangeCodeForToken', () => {
    it('renvoie athlète + tokens depuis la réponse Strava', async () => {
      const tokenResponse = {
        token_type: 'Bearer',
        expires_at: 2000000000,
        expires_in: 21600,
        refresh_token: 'refresh-1',
        access_token: 'access-1',
        athlete: { id: 7, firstname: 'Lucie', lastname: 'D' },
      };
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(tokenResponse),
      } as Response);

      const user = await service.exchangeCodeForToken('the-code');

      expect(user.athlete.id).toBe(7);
      expect(user.accessToken).toBe('access-1');
      expect(user.refreshToken).toBe('refresh-1');
      expect(user.expiresAt).toBe(2000000000);
    });

    it('lève si Strava répond une erreur HTTP', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        status: 400,
        text: () => Promise.resolve('Bad Request'),
      } as Response);

      await expect(service.exchangeCodeForToken('bad')).rejects.toThrow();
    });
  });

  describe('getValidAccessToken', () => {
    it("renvoie le token courant s'il n'est pas expiré", async () => {
      const fetchSpy = jest.spyOn(global, 'fetch');
      const user: SessionUser = {
        athlete: { id: 1 } as SessionUser['athlete'],
        accessToken: 'still-good',
        refreshToken: 'r',
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
      };

      await expect(service.getValidAccessToken(user)).resolves.toBe(
        'still-good',
      );
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('rafraîchit et met à jour la session quand le token est expiré', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            token_type: 'Bearer',
            expires_at: 3000000000,
            expires_in: 21600,
            refresh_token: 'refresh-2',
            access_token: 'access-2',
          }),
      } as Response);

      const user: SessionUser = {
        athlete: { id: 1 } as SessionUser['athlete'],
        accessToken: 'expired',
        refreshToken: 'refresh-1',
        expiresAt: Math.floor(Date.now() / 1000) - 10,
      };

      const token = await service.getValidAccessToken(user);

      expect(token).toBe('access-2');
      expect(user.accessToken).toBe('access-2');
      expect(user.refreshToken).toBe('refresh-2');
      expect(user.expiresAt).toBe(3000000000);
    });
  });
});
