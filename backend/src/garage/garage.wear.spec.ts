import type { CyclingActivity } from '../strava/strava.types';
import {
  computeAgePenalty,
  computeTyreScore,
  statusLabel,
  terrainCoeff,
} from './garage.wear';

function act(partial: Partial<CyclingActivity>): CyclingActivity {
  return {
    id: 1,
    name: 'ride',
    sportType: 'Ride',
    distanceKm: 100,
    movingTimeS: 0,
    elapsedTimeS: 0,
    totalElevationGainM: 0,
    elevHighM: null,
    elevLowM: null,
    averageSpeedKmh: 25,
    maxSpeedKmh: 0,
    averageWatts: null,
    deviceWatts: false,
    startDate: '2025-09-01T08:00:00Z',
    startDateLocal: '2025-09-01T10:00:00',
    startLatlng: null,
    trainer: false,
    commute: false,
    manual: false,
    gearId: 'b1',
    ...partial,
  };
}

describe('terrainCoeff', () => {
  it('vaut 1.0 sur route', () => {
    expect(terrainCoeff(act({ sportType: 'Ride' }))).toBe(1.0);
  });
  it('vaut 1.4 en gravel/VTT', () => {
    expect(terrainCoeff(act({ sportType: 'GravelRide' }))).toBe(1.4);
    expect(terrainCoeff(act({ sportType: 'MountainBikeRide' }))).toBe(1.4);
  });
  it('vaut 1.4 pour EMountainBikeRide', () => {
    expect(terrainCoeff(act({ sportType: 'EMountainBikeRide' }))).toBe(1.4);
  });
});

describe('statusLabel', () => {
  it('classe selon les seuils', () => {
    expect(statusLabel(10)).toBe('Bon état');
    expect(statusLabel(60)).toBe('À surveiller');
    expect(statusLabel(85)).toBe('À remplacer');
  });
  it('respecte les bornes exactes', () => {
    expect(statusLabel(54)).toBe('Bon état');
    expect(statusLabel(55)).toBe('À surveiller');
    expect(statusLabel(79)).toBe('À surveiller');
    expect(statusLabel(80)).toBe('À remplacer');
  });
});

describe('computeAgePenalty', () => {
  it('renvoie 0 dans la période de grâce (≤ 24 mois)', () => {
    expect(computeAgePenalty(0)).toBe(0);
    expect(computeAgePenalty(24)).toBe(0);
  });

  it('calcule la pénalité linéaire entre 24 et 72 mois', () => {
    expect(computeAgePenalty(48)).toBe(50); // (48-24)/(72-24)*100 = 50
    expect(computeAgePenalty(36)).toBe(25); // (36-24)/(72-24)*100 = 25
    expect(computeAgePenalty(60)).toBe(75); // (60-24)/(72-24)*100 = 75
  });

  it('plafonne à 100 % au-delà de 72 mois', () => {
    expect(computeAgePenalty(72)).toBe(100);
    expect(computeAgePenalty(120)).toBe(100);
  });
});

describe('computeTyreScore', () => {
  const now = new Date('2025-10-01T00:00:00Z');

  it("use plus vite à l'arrière (kmMax ajusté plus bas)", () => {
    const acts = [act({ distanceKm: 1000, sportType: 'Ride' })];
    const front = computeTyreScore(acts, 'FRONT', 5000, '2025-08-01', now);
    const rear = computeTyreScore(acts, 'REAR', 5000, '2025-08-01', now);
    expect(front.kmMaxAdjusted).toBe(5000); // 5000 / (1.0 * 1.0)
    expect(rear.kmMaxAdjusted).toBe(2632); // 5000 / (1.9 * 1.0), arrondi
    expect(rear.wearPercent).toBeGreaterThan(front.wearPercent);
  });

  it('ignore home-trainer, saisie manuelle et activités avant la pose', () => {
    const acts = [
      act({ distanceKm: 500 }),
      act({ distanceKm: 999, trainer: true }),
      act({ distanceKm: 999, manual: true }),
      act({ distanceKm: 999, startDate: '2025-07-01T08:00:00Z' }),
    ];
    const score = computeTyreScore(acts, 'FRONT', 5000, '2025-08-01', now);
    expect(score.kmUsed).toBe(500);
  });

  it("plafonne l'usure à 100%", () => {
    const acts = [act({ distanceKm: 10000 })];
    const score = computeTyreScore(acts, 'FRONT', 5000, '2025-08-01', now);
    expect(score.wearPercent).toBe(100);
    expect(score.kmLeft).toBe(0);
  });

  it('renvoie une usure nulle (pas NaN) si lifetimeKm <= 0', () => {
    const acts = [act({ distanceKm: 500 })];
    const score = computeTyreScore(acts, 'FRONT', 0, '2025-08-01', now);
    expect(score.kmUsed).toBe(500);
    expect(score.kmMaxAdjusted).toBe(0);
    expect(score.wearPercent).toBe(0);
    expect(score.kmLeft).toBe(0);
  });

  it("intègre la pénalité d'âge dans wearPercent", () => {
    // Pneu posé il y a 48 mois → pénalité âge 50 %
    const mountedDate = '2021-10-01';
    const future = new Date('2025-10-01T00:00:00Z'); // 48 mois après
    const acts = [act({ distanceKm: 500, startDate: '2022-01-01T08:00:00Z' })];
    const score = computeTyreScore(acts, 'FRONT', 5000, mountedDate, future);
    // kmWear = 500/5000*100 = 10 %, agePenalty = 50 % → total = 60 %
    expect(score.agePenaltyPercent).toBe(50);
    expect(score.ageMonths).toBe(48);
    expect(score.wearPercent).toBe(60);
    expect(score.statusLabel).toBe('À surveiller');
  });

  it("plafonne wearPercent à 100 même avec km + pénalité d'âge > 100", () => {
    const mountedDate = '2018-10-01';
    const future = new Date('2025-10-01T00:00:00Z'); // 84 mois → pénalité 100 %
    const acts = [act({ distanceKm: 3000, startDate: '2019-01-01T08:00:00Z' })];
    const score = computeTyreScore(acts, 'FRONT', 5000, mountedDate, future);
    expect(score.agePenaltyPercent).toBe(100);
    expect(score.wearPercent).toBe(100);
  });
});
