/// <reference types="jest" />
import { ConfigService } from '@nestjs/config';
import type { User } from '../users/user.entity';
import type { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

function makeConfig(values: Record<string, string>): ConfigService {
  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService;
}

function makeUsersService(): jest.Mocked<UsersService> {
  return {
    findOrCreate: jest.fn(),
    updateTokens: jest.fn(),
    findByStravaId: jest.fn(),
  } as unknown as jest.Mocked<UsersService>;
}

const ENV = {
  STRAVA_CLIENT_ID: '12345',
  STRAVA_CLIENT_SECRET: 'secret',
  STRAVA_CALLBACK_URL: 'http://localhost:3001/auth/callback',
};

describe('AuthService', () => {
  let service!: AuthService;
  let usersService!: jest.Mocked<UsersService>;

  beforeEach(() => {
    usersService = makeUsersService();
    service = new AuthService(makeConfig(ENV), usersService);
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
      expect(url.searchParams.get('scope')).toBe(
        'read,profile:read_all,activity:read_all',
      );
      expect(url.searchParams.get('state')).toBe('state-abc');
    });
  });

  describe('exchangeCodeForToken', () => {
    it("persiste l'athlète en base et renvoie l'entité User", async () => {
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
      const fakeUser = { stravaId: 7, accessToken: 'access-1' } as User;
      usersService.findOrCreate.mockResolvedValue(fakeUser);

      const user = await service.exchangeCodeForToken('the-code');

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(usersService.findOrCreate).toHaveBeenCalledWith(
        tokenResponse.athlete,
        {
          accessToken: 'access-1',
          refreshToken: 'refresh-1',
          tokenExpiresAt: 2000000000,
        },
      );
      expect(user).toBe(fakeUser);
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
      const user = {
        stravaId: 1,
        accessToken: 'still-good',
        refreshToken: 'r',
        tokenExpiresAt: Math.floor(Date.now() / 1000) + 3600,
      } as User;

      await expect(service.getValidAccessToken(user)).resolves.toBe(
        'still-good',
      );
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('rafraîchit et met à jour la DB quand le token est expiré', async () => {
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
      usersService.updateTokens.mockResolvedValue({} as User);

      const user = {
        stravaId: 1,
        accessToken: 'expired',
        refreshToken: 'refresh-1',
        tokenExpiresAt: Math.floor(Date.now() / 1000) - 10,
      } as User;

      const token = await service.getValidAccessToken(user);

      expect(token).toBe('access-2');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(usersService.updateTokens).toHaveBeenCalledWith(user, {
        accessToken: 'access-2',
        refreshToken: 'refresh-2',
        tokenExpiresAt: 3000000000,
      });
    });
  });
});
