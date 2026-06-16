import type { Repository } from 'typeorm';
import type { StravaService } from '../strava/strava.service';
import type { CyclingActivity } from '../strava/strava.types';
import type { User } from '../users/user.entity';
import { ProfileSnapshot } from './profile-snapshot.entity';
import { ProfileService } from './profile.service';
import type { WeatherService } from './weather/weather.service';

const FIXED_NOW = new Date('2026-06-16T12:00:00Z');
const TTL_MS = 12 * 60 * 60 * 1000;

function ride(overrides: Partial<CyclingActivity> = {}): CyclingActivity {
  return {
    id: 1,
    name: 'Ride',
    sportType: 'Ride',
    distanceKm: 40,
    movingTimeS: 3600,
    elapsedTimeS: 3600,
    totalElevationGainM: 100,
    elevHighM: null,
    elevLowM: null,
    averageSpeedKmh: 40,
    maxSpeedKmh: 50,
    averageWatts: null,
    deviceWatts: false,
    startDate: '2026-05-01T08:00:00Z',
    startDateLocal: '2026-05-01T10:00:00',
    startLatlng: [45.5, 3.1],
    trainer: false,
    commute: false,
    manual: false,
    gearId: null,
    ...overrides,
  };
}

const user = { id: 7, city: 'Lyon', state: null, country: 'France' } as User;

describe('ProfileService.getProfile', () => {
  let strava: { getCyclingActivities: jest.Mock };
  let weather: { getRainExposure: jest.Mock };
  let repo: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  let service: ProfileService;

  beforeAll(() => {
    jest.useFakeTimers();
  });
  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    jest.setSystemTime(FIXED_NOW);
    strava = { getCyclingActivities: jest.fn() };
    weather = { getRainExposure: jest.fn() };
    repo = { findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
    service = new ProfileService(
      strava as unknown as StravaService,
      weather as unknown as WeatherService,
      repo as unknown as Repository<ProfileSnapshot>,
    );
  });

  it('renvoie le snapshot en cache sans toucher Strava si frais', async () => {
    const cached = { rain_percentage: 10, rainy_rides: 1, ride_count: 5 };
    repo.findOne.mockResolvedValue({
      userId: user.id,
      profile: JSON.stringify(cached),
      computedAt: FIXED_NOW.getTime() - 1000, // < TTL
    });

    const result = await service.getProfile(user);

    expect(result).toEqual(cached);
    expect(strava.getCyclingActivities).not.toHaveBeenCalled();
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('recalcule et persiste quand aucun snapshot n existe', async () => {
    repo.findOne.mockResolvedValue(null);
    repo.create.mockReturnValue({ userId: user.id });
    repo.save.mockResolvedValue({});
    strava.getCyclingActivities.mockResolvedValue([ride()]);
    weather.getRainExposure.mockResolvedValue({ rain_percentage: 25, rainy_rides: 1 });

    const result = await service.getProfile(user);

    expect(strava.getCyclingActivities).toHaveBeenCalledWith(user);
    expect(result.ride_count).toBe(1);
    expect(result.region).toBe('Lyon, France');
    expect(result.weather_exposure).toEqual({ rain_percentage: 25, rainy_rides: 1 });
    expect(repo.save).toHaveBeenCalledTimes(1);
    const saved = repo.save.mock.calls[0][0];
    expect(saved.computedAt).toBe(FIXED_NOW.getTime());
    expect(JSON.parse(saved.profile).ride_count).toBe(1);
  });

  it('recalcule quand le snapshot a dépassé le TTL', async () => {
    repo.findOne.mockResolvedValue({
      userId: user.id,
      profile: JSON.stringify({ ride_count: 99 }),
      computedAt: FIXED_NOW.getTime() - TTL_MS - 1, // expiré
    });
    repo.save.mockResolvedValue({});
    strava.getCyclingActivities.mockResolvedValue([ride()]);
    weather.getRainExposure.mockResolvedValue({ rain_percentage: 0, rainy_rides: 0 });

    const result = await service.getProfile(user);

    expect(strava.getCyclingActivities).toHaveBeenCalled();
    expect(result.ride_count).toBe(1);
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it('recalcule quand refresh=true même si le snapshot est frais', async () => {
    repo.findOne.mockResolvedValue({
      userId: user.id,
      profile: JSON.stringify({ ride_count: 99 }),
      computedAt: FIXED_NOW.getTime(), // frais
    });
    repo.save.mockResolvedValue({});
    strava.getCyclingActivities.mockResolvedValue([ride()]);
    weather.getRainExposure.mockResolvedValue({ rain_percentage: 0, rainy_rides: 0 });

    const result = await service.getProfile(user, { refresh: true });

    expect(strava.getCyclingActivities).toHaveBeenCalled();
    expect(result.ride_count).toBe(1);
  });
});
