/// <reference types="jest" />
import type { Repository } from 'typeorm';
import type { StravaAthlete } from '../auth/auth.types';
import { User } from './user.entity';
import { UsersService, type TokenData } from './users.service';

const TOKENS: TokenData = {
  accessToken: 'at',
  refreshToken: 'rt',
  tokenExpiresAt: 9_999_999_999,
};

const ATHLETE: StravaAthlete = {
  id: 42,
  firstname: 'Alice',
  lastname: 'Martin',
  city: 'Lyon',
  state: 'Rhône',
  country: 'France',
  sex: 'F',
  profile: '',
};

function makeRepo(
  overrides: Partial<Record<keyof Repository<User>, jest.Mock>> = {},
) {
  return {
    findOneBy: jest.fn().mockResolvedValue(null),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    ...overrides,
  } as unknown as Repository<User>;
}

describe('UsersService', () => {
  describe('findByStravaId', () => {
    it('délègue à repo.findOneBy avec le bon stravaId', async () => {
      const findOneBy = jest.fn().mockResolvedValue(null);
      const service = new UsersService(makeRepo({ findOneBy }));

      const result = await service.findByStravaId(42);

      expect(findOneBy).toHaveBeenCalledWith({ stravaId: 42 });
      expect(result).toBeNull();
    });

    it('retourne le user quand il existe', async () => {
      const user = Object.assign(new User(), { id: 1, stravaId: 42 });
      const findOneBy = jest.fn().mockResolvedValue(user);
      const service = new UsersService(makeRepo({ findOneBy }));

      const result = await service.findByStravaId(42);

      expect(result).toBe(user);
    });
  });

  describe('findOrCreate — utilisateur existant', () => {
    it('met à jour les infos athlète et les tokens puis sauvegarde', async () => {
      const existing = Object.assign(new User(), { id: 1, stravaId: 42 });
      const create = jest.fn();
      const save = jest
        .fn()
        .mockImplementation((u: User) => Promise.resolve(u));
      const service = new UsersService(
        makeRepo({
          findOneBy: jest.fn().mockResolvedValue(existing),
          create,
          save,
        }),
      );

      const user = await service.findOrCreate(ATHLETE, TOKENS);

      expect(create).not.toHaveBeenCalled();
      expect(user.firstname).toBe('Alice');
      expect(user.lastname).toBe('Martin');
      expect(user.city).toBe('Lyon');
      expect(user.accessToken).toBe('at');
      expect(user.refreshToken).toBe('rt');
      expect(save).toHaveBeenCalledWith(existing);
    });
  });

  describe('findOrCreate — nouvel utilisateur', () => {
    it('crée et sauvegarde un user quand il est absent en base', async () => {
      const created = Object.assign(new User(), { stravaId: 42 });
      const create = jest.fn().mockReturnValue(created);
      const save = jest
        .fn()
        .mockImplementation((u: User) => Promise.resolve({ ...u, id: 99 }));
      const service = new UsersService(
        makeRepo({
          findOneBy: jest.fn().mockResolvedValue(null),
          create,
          save,
        }),
      );

      await service.findOrCreate(ATHLETE, TOKENS);

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          stravaId: 42,
          firstname: 'Alice',
          lastname: 'Martin',
          accessToken: 'at',
        }),
      );
      expect(save).toHaveBeenCalled();
    });
  });

  describe('updateTokens', () => {
    it('remplace les tokens sur le user et sauvegarde', async () => {
      const user = Object.assign(new User(), { id: 1 });
      const save = jest
        .fn()
        .mockImplementation((u: User) => Promise.resolve(u));
      const service = new UsersService(makeRepo({ save }));

      const updated = await service.updateTokens(user, {
        accessToken: 'new-at',
        refreshToken: 'new-rt',
        tokenExpiresAt: 1_234_567_890,
      });

      expect(updated.accessToken).toBe('new-at');
      expect(updated.refreshToken).toBe('new-rt');
      expect(updated.tokenExpiresAt).toBe(1_234_567_890);
      expect(save).toHaveBeenCalledWith(user);
    });
  });

  describe('delete', () => {
    it('appelle repo.delete avec le bon id', async () => {
      const del = jest.fn().mockResolvedValue({ affected: 1 });
      const service = new UsersService(makeRepo({ delete: del }));

      await service.delete(7);

      expect(del).toHaveBeenCalledWith(7);
    });
  });
});
