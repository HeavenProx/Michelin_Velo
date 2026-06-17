import type { Repository } from 'typeorm';
import type { StravaService } from '../strava/strava.service';
import type { ProfileService } from '../profile/profile.service';
import type { User } from '../users/user.entity';
import { Bike } from './bike.entity';
import { GarageTyre } from './garage-tyre.entity';
import type { TyreModel } from '../tyres/tyre-model.entity';
import { GarageService } from './garage.service';

const user = { id: 7 } as User;

function makeService(
  over: {
    bikeRepo?: Partial<Repository<Bike>>;
    tyreRepo?: Partial<Repository<GarageTyre>>;
    modelRepo?: Partial<Repository<TyreModel>>;
    strava?: Partial<StravaService>;
    profile?: Partial<ProfileService>;
  } = {},
) {
  return new GarageService(
    (over.bikeRepo ?? {}) as Repository<Bike>,
    (over.tyreRepo ?? {}) as Repository<GarageTyre>,
    (over.modelRepo ?? {}) as Repository<TyreModel>,
    (over.strava ?? {}) as StravaService,
    (over.profile ?? {}) as ProfileService,
  );
}

describe('GarageService.syncBikes', () => {
  it('crée les vélos absents et met à jour les existants', async () => {
    const existing = Object.assign(new Bike(), {
      id: 1,
      userId: 7,
      stravaGearId: 'b1',
      name: 'Ancien nom',
      stravaDistanceKm: 0,
    });
    const saved: Bike[] = [];
    const service = makeService({
      strava: {
        getAthleteBikes: jest.fn().mockResolvedValue([
          { gearId: 'b1', name: 'Tarmac', distanceKm: 1500, primary: true },
          { gearId: 'b2', name: 'Checkpoint', distanceKm: 800, primary: false },
        ]),
      },
      bikeRepo: {
        find: jest.fn().mockResolvedValue([existing]),
        create: jest.fn((d) => Object.assign(new Bike(), d)),
        save: jest.fn((b) => {
          saved.push(b as Bike);
          return Promise.resolve(b);
        }),
      },
    });

    const result = await service.syncBikes(user);

    expect(result).toHaveLength(2);
    expect(saved.find((b) => b.stravaGearId === 'b1')?.name).toBe('Tarmac');
    expect(saved.find((b) => b.stravaGearId === 'b2')?.name).toBe('Checkpoint');
  });
});
