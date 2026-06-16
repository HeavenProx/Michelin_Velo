# Profiler cycliste (backend) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire le profiler backend qui transforme les activités vélo Strava d'un athlète connecté en objet `profile` du contrat d'API (terrain, style, km, météo, région), avec cache DB.

**Architecture :** Un module NestJS `ProfileModule` qui isole le calcul métier déterministe (fonctions pures `profile.stats.ts`, testées sans mock) de l'I/O réseau coûteux (`WeatherService` → Open-Meteo, mockable). `ProfileService` orchestre : cache snapshot DB (TTL 12 h) → Strava → stats → météo → assemblage → persistance. Aucune route exposée dans ce périmètre (le futur `RecommendModule` consommera `ProfileService.getProfile()`).

**Tech Stack :** NestJS 11, TypeScript, TypeORM (`better-sqlite3`, `synchronize: true`), Jest + ts-jest, `fetch` global (Node 22). Gestionnaire **pnpm**, dossier de travail `backend/`.

**Spec de référence :** `docs/superpowers/specs/2026-06-16-profiler-design.md`

---

## File Structure

```
backend/src/profile/
  profile.types.ts            # RiderProfile, WeatherExposure (= shape du contrat)
  profile-snapshot.entity.ts  # cache DB : userId (unique), profile JSON, computedAt
  profile.stats.ts            # FONCTIONS PURES : agrégats, terrain, style, région
  profile.stats.spec.ts       # tests unitaires purs (cœur de la confiance)
  profile.service.ts          # orchestration + cache snapshot
  profile.service.spec.ts     # tests : cache hit / miss / TTL / refresh (deps mockées)
  profile.module.ts           # câblage NestJS
  weather/
    weather.service.ts        # Open-Meteo archive (historique pluie), I/O isolé
    weather.service.spec.ts   # tests : seuil pluie, cache, donnée manquante (fetch mocké)
```

Modifié :
- `backend/src/app.module.ts` — ajouter `ProfileSnapshot` aux `entities` et importer `ProfileModule`.

**Convention commandes :** toutes les commandes s'exécutent depuis `backend/`. Lancer un test ciblé : `pnpm test -- <chemin-relatif-au-src>`. Build : `pnpm build`.

---

## Task 1 : Types & entité de cache

**Files:**
- Create: `backend/src/profile/profile.types.ts`
- Create: `backend/src/profile/profile-snapshot.entity.ts`
- Modify: `backend/src/app.module.ts`

- [ ] **Step 1 : Créer le type `RiderProfile`**

`backend/src/profile/profile.types.ts` :

```ts
/** Exposition à la pluie, sous-objet du contrat d'API. */
export interface WeatherExposure {
  rain_percentage: number;
  rainy_rides: number;
}

/**
 * Profil cycliste produit par le profiler.
 * Shape exacte attendue par le front (clé `profile` du contrat d'API, cf. CLAUDE.md).
 */
export interface RiderProfile {
  ride_count: number;
  total_distance_km: number;
  monthly_distance: number;
  avg_speed_kmh: number;
  avg_elevation_m: number;
  terrain_label: string;
  style_label: string;
  weather_exposure: WeatherExposure;
  region: string;
}
```

- [ ] **Step 2 : Créer l'entité `ProfileSnapshot`**

`backend/src/profile/profile-snapshot.entity.ts` :

```ts
import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

/**
 * Cache du profil calculé : une ligne par utilisateur (relation 1-1).
 * `profile` stocke le RiderProfile sérialisé ; `computedAt` sert au TTL.
 */
@Entity('profile_snapshots')
export class ProfileSnapshot {
  @PrimaryGeneratedColumn()
  id!: number;

  @OneToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ unique: true })
  userId!: number;

  /** RiderProfile sérialisé en JSON. */
  @Column('text')
  profile!: string;

  /** Timestamp epoch (ms) du dernier calcul, pour évaluer le TTL. */
  @Column('integer')
  computedAt!: number;

  @UpdateDateColumn()
  updatedAt!: Date;
}
```

- [ ] **Step 3 : Enregistrer l'entité dans TypeORM**

Dans `backend/src/app.module.ts`, ajouter l'import et l'entité au tableau `entities` (l'app utilise une liste explicite, pas `autoLoadEntities`).

Ajouter en haut, après l'import de `User` :

```ts
import { ProfileSnapshot } from './profile/profile-snapshot.entity';
```

Remplacer `entities: [User],` par :

```ts
        entities: [User, ProfileSnapshot],
```

- [ ] **Step 4 : Vérifier que le build passe**

Run: `pnpm build`
Expected: build OK, aucune erreur TypeScript. `synchronize: true` créera la table `profile_snapshots` au prochain démarrage.

- [ ] **Step 5 : Commit**

```bash
git add backend/src/profile/profile.types.ts backend/src/profile/profile-snapshot.entity.ts backend/src/app.module.ts
git commit -m "feat(profile): type RiderProfile et entité de cache ProfileSnapshot"
```

---

## Task 2 : Fonctions pures de statistiques (`profile.stats.ts`)

C'est le cœur de la confiance : fonctions pures `CyclingActivity[] → valeurs`, testées en isolation totale (aucun mock). On écrit d'abord tous les tests, puis l'implémentation.

**Files:**
- Test: `backend/src/profile/profile.stats.spec.ts`
- Create: `backend/src/profile/profile.stats.ts`

- [ ] **Step 1 : Écrire les tests (ils doivent échouer)**

`backend/src/profile/profile.stats.spec.ts` :

```ts
import type { CyclingActivity } from '../strava/strava.types';
import {
  avgElevationM,
  avgSpeedKmh,
  computeProfileStats,
  monthlyDistance,
  resolveRegion,
  rideCount,
  styleLabel,
  terrainLabel,
  totalDistanceKm,
} from './profile.stats';

/** Fabrique une activité vélo avec des valeurs par défaut surchargales. */
function ride(overrides: Partial<CyclingActivity> = {}): CyclingActivity {
  return {
    id: 1,
    name: 'Ride',
    sportType: 'Ride',
    distanceKm: 30,
    movingTimeS: 3600,
    elapsedTimeS: 3600,
    totalElevationGainM: 200,
    elevHighM: null,
    elevLowM: null,
    averageSpeedKmh: 30,
    maxSpeedKmh: 40,
    averageWatts: null,
    deviceWatts: false,
    startDate: '2026-01-01T08:00:00Z',
    startDateLocal: '2026-01-01T09:00:00',
    startLatlng: [45.5, 3.1],
    trainer: false,
    commute: false,
    manual: false,
    gearId: null,
    ...overrides,
  };
}

describe('rideCount', () => {
  it('renvoie 0 pour une liste vide', () => {
    expect(rideCount([])).toBe(0);
  });
  it('compte les activités', () => {
    expect(rideCount([ride(), ride(), ride()])).toBe(3);
  });
});

describe('totalDistanceKm', () => {
  it('somme les distances, arrondi 1 décimale', () => {
    expect(totalDistanceKm([ride({ distanceKm: 10.25 }), ride({ distanceKm: 5.05 })])).toBe(15.3);
  });
  it('renvoie 0 pour une liste vide', () => {
    expect(totalDistanceKm([])).toBe(0);
  });
});

describe('avgSpeedKmh', () => {
  it('est une moyenne pondérée par la distance (pas une moyenne de moyennes)', () => {
    // 30 km en 1 h + 60 km en 1 h = 90 km en 2 h = 45 km/h
    const a = ride({ distanceKm: 30, movingTimeS: 3600 });
    const b = ride({ distanceKm: 60, movingTimeS: 3600 });
    expect(avgSpeedKmh([a, b])).toBe(45);
  });
  it('renvoie 0 si le temps de mouvement total est nul', () => {
    expect(avgSpeedKmh([ride({ distanceKm: 10, movingTimeS: 0 })])).toBe(0);
  });
});

describe('avgElevationM', () => {
  it('moyenne le dénivelé par sortie, arrondi entier', () => {
    const rides = [
      ride({ totalElevationGainM: 100 }),
      ride({ totalElevationGainM: 200 }),
      ride({ totalElevationGainM: 300 }),
    ];
    expect(avgElevationM(rides)).toBe(200);
  });
  it('renvoie 0 pour une liste vide', () => {
    expect(avgElevationM([])).toBe(0);
  });
});

describe('monthlyDistance', () => {
  it('divise la distance totale par le nombre de mois couverts', () => {
    // 1er ride 2026-01-01, now 2026-03-02 → 60 jours → ceil(60/30)=2 mois → 300/2=150
    const rides = [
      ride({ distanceKm: 150, startDate: '2026-01-01T00:00:00Z' }),
      ride({ distanceKm: 150, startDate: '2026-02-15T00:00:00Z' }),
    ];
    expect(monthlyDistance(rides, new Date('2026-03-02T00:00:00Z'))).toBe(150);
  });
  it('garde un minimum de 1 mois pour un cycliste récent', () => {
    const rides = [ride({ distanceKm: 50, startDate: '2026-03-10T00:00:00Z' })];
    expect(monthlyDistance(rides, new Date('2026-03-20T00:00:00Z'))).toBe(50);
  });
  it('renvoie 0 pour une liste vide', () => {
    expect(monthlyDistance([], new Date('2026-03-20T00:00:00Z'))).toBe(0);
  });
});

describe('terrainLabel (densité de grimpe m/km)', () => {
  it('< 8 m/km → Plat', () => {
    expect(terrainLabel([ride({ distanceKm: 50, totalElevationGainM: 100 })])).toBe('Plat'); // 2
  });
  it('8 m/km (borne basse) → Mixte', () => {
    expect(terrainLabel([ride({ distanceKm: 50, totalElevationGainM: 400 })])).toBe('Mixte'); // 8
  });
  it('18 m/km (borne haute) → Mixte', () => {
    expect(terrainLabel([ride({ distanceKm: 50, totalElevationGainM: 900 })])).toBe('Mixte'); // 18
  });
  it('> 18 m/km → Montagne', () => {
    expect(terrainLabel([ride({ distanceKm: 50, totalElevationGainM: 1500 })])).toBe('Montagne'); // 30
  });
});

describe('styleLabel (échelle de priorité)', () => {
  it('VTT si le type dominant est MountainBikeRide', () => {
    const rides = [ride({ sportType: 'MountainBikeRide' }), ride({ sportType: 'MountainBikeRide' }), ride({ sportType: 'Ride' })];
    expect(styleLabel(rides)).toBe('VTT');
  });
  it('Gravel si le type dominant est GravelRide', () => {
    const rides = [ride({ sportType: 'GravelRide' }), ride({ sportType: 'GravelRide' }), ride({ sportType: 'Ride' })];
    expect(styleLabel(rides)).toBe('Gravel');
  });
  it('Performance sur route si vitesse moyenne ≥ 28 km/h', () => {
    const rides = [ride({ sportType: 'Ride', distanceKm: 30, movingTimeS: 3600 })]; // 30 km/h
    expect(styleLabel(rides)).toBe('Performance');
  });
  it('Endurance sur route si vitesse < 28 mais distance moyenne ≥ 60 km', () => {
    const rides = [ride({ sportType: 'Ride', distanceKm: 120, movingTimeS: 17280 })]; // 25 km/h, 120 km
    expect(styleLabel(rides)).toBe('Endurance');
  });
  it('Loisir / polyvalent sinon', () => {
    const rides = [ride({ sportType: 'Ride', distanceKm: 30, movingTimeS: 5400 })]; // 20 km/h, 30 km
    expect(styleLabel(rides)).toBe('Loisir / polyvalent');
  });
});

describe('resolveRegion', () => {
  it('combine ville et pays', () => {
    expect(resolveRegion({ city: 'Clermont-Ferrand', state: null, country: 'France' })).toBe(
      'Clermont-Ferrand, France',
    );
  });
  it('utilise la région (state) si la ville est nulle', () => {
    expect(resolveRegion({ city: null, state: 'Auvergne', country: 'France' })).toBe('Auvergne, France');
  });
  it('renvoie une chaîne vide si tout est nul', () => {
    expect(resolveRegion({ city: null, state: null, country: null })).toBe('');
  });
});

describe('computeProfileStats', () => {
  const user = { city: 'Lyon', state: null, country: 'France' };

  it('renvoie des zéros et des labels neutres pour 0 activité', () => {
    const stats = computeProfileStats([], user, new Date('2026-03-02T00:00:00Z'));
    expect(stats).toEqual({
      ride_count: 0,
      total_distance_km: 0,
      monthly_distance: 0,
      avg_speed_kmh: 0,
      avg_elevation_m: 0,
      terrain_label: 'Données insuffisantes',
      style_label: 'Données insuffisantes',
      region: 'Lyon, France',
    });
  });

  it('assemble tous les agrégats pour un jeu non vide', () => {
    const rides = [
      ride({ distanceKm: 30, movingTimeS: 3600, totalElevationGainM: 100, startDate: '2026-01-01T00:00:00Z', sportType: 'Ride' }),
      ride({ distanceKm: 60, movingTimeS: 3600, totalElevationGainM: 500, startDate: '2026-02-01T00:00:00Z', sportType: 'Ride' }),
    ];
    const stats = computeProfileStats(rides, user, new Date('2026-03-02T00:00:00Z'));
    expect(stats.ride_count).toBe(2);
    expect(stats.total_distance_km).toBe(90);
    expect(stats.avg_speed_kmh).toBe(45); // 90 km / 2 h
    expect(stats.avg_elevation_m).toBe(300); // (100+500)/2
    expect(stats.region).toBe('Lyon, France');
    expect(stats.terrain_label).toBe('Plat'); // 600/90 ≈ 6.7 m/km
    expect(stats.style_label).toBe('Performance'); // 45 km/h
  });
});
```

- [ ] **Step 2 : Lancer les tests pour vérifier qu'ils échouent**

Run: `pnpm test -- profile/profile.stats.spec.ts`
Expected: FAIL — `Cannot find module './profile.stats'` (le fichier n'existe pas encore).

- [ ] **Step 3 : Écrire l'implémentation**

`backend/src/profile/profile.stats.ts` :

```ts
import type { CyclingActivity } from '../strava/strava.types';
import type { User } from '../users/user.entity';
import type { RiderProfile } from './profile.types';

const MS_PER_DAY = 86_400_000;
const NEUTRAL_LABEL = 'Données insuffisantes';

/** Arrondi à une décimale. */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function rideCount(activities: CyclingActivity[]): number {
  return activities.length;
}

export function totalDistanceKm(activities: CyclingActivity[]): number {
  const sum = activities.reduce((acc, a) => acc + a.distanceKm, 0);
  return round1(sum);
}

/** Vraie moyenne pondérée par la distance : Σ km / (Σ s de mouvement / 3600). */
export function avgSpeedKmh(activities: CyclingActivity[]): number {
  const distKm = activities.reduce((acc, a) => acc + a.distanceKm, 0);
  const movingS = activities.reduce((acc, a) => acc + a.movingTimeS, 0);
  if (movingS === 0) return 0;
  return round1(distKm / (movingS / 3600));
}

/** Dénivelé moyen PAR SORTIE (Σ D+ / nb de sorties). */
export function avgElevationM(activities: CyclingActivity[]): number {
  if (activities.length === 0) return 0;
  const sum = activities.reduce((acc, a) => acc + a.totalElevationGainM, 0);
  return Math.round(sum / activities.length);
}

export function monthlyDistance(activities: CyclingActivity[], now: Date): number {
  if (activities.length === 0) return 0;
  const total = activities.reduce((acc, a) => acc + a.distanceKm, 0);
  const firstMs = Math.min(...activities.map((a) => new Date(a.startDate).getTime()));
  const days = (now.getTime() - firstMs) / MS_PER_DAY;
  const monthsCovered = Math.max(1, Math.ceil(days / 30));
  return Math.round(total / monthsCovered);
}

/** Densité de grimpe = dénivelé total / distance totale (m/km). */
export function terrainLabel(activities: CyclingActivity[]): string {
  const dist = activities.reduce((acc, a) => acc + a.distanceKm, 0);
  if (dist === 0) return 'Plat';
  const elev = activities.reduce((acc, a) => acc + a.totalElevationGainM, 0);
  const density = elev / dist;
  if (density < 8) return 'Plat';
  if (density <= 18) return 'Mixte';
  return 'Montagne';
}

/** Type de sport le plus fréquent dans l'échantillon. */
function dominantSportType(activities: CyclingActivity[]): string {
  const counts = new Map<string, number>();
  for (const a of activities) {
    counts.set(a.sportType, (counts.get(a.sportType) ?? 0) + 1);
  }
  let best = '';
  let bestCount = -1;
  for (const [type, count] of counts) {
    if (count > bestCount) {
      best = type;
      bestCount = count;
    }
  }
  return best;
}

/** Échelle de priorité : type dominant, puis vitesse, puis distance moyenne. */
export function styleLabel(activities: CyclingActivity[]): string {
  if (activities.length === 0) return NEUTRAL_LABEL;
  const dominant = dominantSportType(activities);
  if (dominant === 'MountainBikeRide') return 'VTT';
  if (dominant === 'GravelRide') return 'Gravel';

  const speed = avgSpeedKmh(activities);
  const distPerRide =
    activities.reduce((acc, a) => acc + a.distanceKm, 0) / activities.length;
  if (speed >= 28) return 'Performance';
  if (distPerRide >= 60) return 'Endurance';
  return 'Loisir / polyvalent';
}

export function resolveRegion(
  user: Pick<User, 'city' | 'state' | 'country'>,
): string {
  const place = user.city ?? user.state ?? null;
  return [place, user.country].filter(Boolean).join(', ');
}

/**
 * Assemble la partie déterministe du profil (tout sauf weather_exposure).
 * Court-circuite le cas « aucune activité » avec des labels neutres.
 */
export function computeProfileStats(
  activities: CyclingActivity[],
  user: Pick<User, 'city' | 'state' | 'country'>,
  now: Date,
): Omit<RiderProfile, 'weather_exposure'> {
  if (activities.length === 0) {
    return {
      ride_count: 0,
      total_distance_km: 0,
      monthly_distance: 0,
      avg_speed_kmh: 0,
      avg_elevation_m: 0,
      terrain_label: NEUTRAL_LABEL,
      style_label: NEUTRAL_LABEL,
      region: resolveRegion(user),
    };
  }

  return {
    ride_count: rideCount(activities),
    total_distance_km: totalDistanceKm(activities),
    monthly_distance: monthlyDistance(activities, now),
    avg_speed_kmh: avgSpeedKmh(activities),
    avg_elevation_m: avgElevationM(activities),
    terrain_label: terrainLabel(activities),
    style_label: styleLabel(activities),
    region: resolveRegion(user),
  };
}
```

- [ ] **Step 4 : Lancer les tests pour vérifier qu'ils passent**

Run: `pnpm test -- profile/profile.stats.spec.ts`
Expected: PASS — tous les `describe` verts.

- [ ] **Step 5 : Commit**

```bash
git add backend/src/profile/profile.stats.ts backend/src/profile/profile.stats.spec.ts
git commit -m "feat(profile): fonctions pures de stats (agrégats, terrain, style, région)"
```

---

## Task 3 : `WeatherService` (Open-Meteo archive)

Isole l'I/O réseau. Expose `getRainExposure(activities) → WeatherExposure`. Testé avec `fetch` mocké.

**Files:**
- Test: `backend/src/profile/weather/weather.service.spec.ts`
- Create: `backend/src/profile/weather/weather.service.ts`

- [ ] **Step 1 : Écrire les tests (ils doivent échouer)**

`backend/src/profile/weather/weather.service.spec.ts` :

```ts
import type { CyclingActivity } from '../../strava/strava.types';
import { WeatherService } from './weather.service';

function ride(overrides: Partial<CyclingActivity> = {}): CyclingActivity {
  return {
    id: 1,
    name: 'Ride',
    sportType: 'Ride',
    distanceKm: 30,
    movingTimeS: 3600,
    elapsedTimeS: 3600,
    totalElevationGainM: 200,
    elevHighM: null,
    elevLowM: null,
    averageSpeedKmh: 30,
    maxSpeedKmh: 40,
    averageWatts: null,
    deviceWatts: false,
    startDate: '2026-05-10T08:00:00Z',
    startDateLocal: '2026-05-10T10:00:00',
    startLatlng: [45.5, 3.1],
    trainer: false,
    commute: false,
    manual: false,
    gearId: null,
    ...overrides,
  };
}

/** Réponse Open-Meteo archive simulée pour une valeur de précipitation. */
function archiveResponse(precipitationSum: number | null) {
  return {
    ok: true,
    json: async () => ({
      daily: { time: ['2026-05-10'], precipitation_sum: [precipitationSum] },
    }),
  } as Response;
}

describe('WeatherService.getRainExposure', () => {
  let service: WeatherService;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    service = new WeatherService();
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('ne fait aucun appel et renvoie {0,0} sans ride géolocalisé', async () => {
    const result = await service.getRainExposure([ride({ startLatlng: null })]);
    expect(result).toEqual({ rain_percentage: 0, rainy_rides: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('classe un jour comme pluvieux au-dessus de 1 mm', async () => {
    fetchMock.mockResolvedValueOnce(archiveResponse(2));
    const result = await service.getRainExposure([ride()]);
    expect(result).toEqual({ rain_percentage: 100, rainy_rides: 1 });
  });

  it('ne classe pas comme pluvieux à 1 mm ou moins', async () => {
    fetchMock.mockResolvedValueOnce(archiveResponse(0.5));
    const result = await service.getRainExposure([ride()]);
    expect(result).toEqual({ rain_percentage: 0, rainy_rides: 0 });
  });

  it('calcule le pourcentage sur l échantillon (1 pluvieux / 2)', async () => {
    fetchMock
      .mockResolvedValueOnce(archiveResponse(5)) // ride le plus récent
      .mockResolvedValueOnce(archiveResponse(0)); // ride plus ancien
    const rides = [
      ride({ startDateLocal: '2026-05-10T10:00:00', startDate: '2026-05-10T08:00:00Z' }),
      ride({ startDateLocal: '2026-05-01T10:00:00', startDate: '2026-05-01T08:00:00Z', startLatlng: [48.8, 2.3] }),
    ];
    const result = await service.getRainExposure(rides);
    expect(result).toEqual({ rain_percentage: 50, rainy_rides: 1 });
  });

  it('mutualise les appels pour des départs proches le même jour (cache)', async () => {
    fetchMock.mockResolvedValueOnce(archiveResponse(3));
    const rides = [
      ride({ startLatlng: [45.501, 3.101] }),
      ride({ startLatlng: [45.504, 3.104] }), // même clé à 2 décimales et même date
    ];
    const result = await service.getRainExposure(rides);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ rain_percentage: 100, rainy_rides: 2 });
  });

  it('exclut du dénominateur les jours sans donnée (latence archive)', async () => {
    fetchMock
      .mockResolvedValueOnce(archiveResponse(5)) // récent : pluvieux
      .mockResolvedValueOnce(archiveResponse(null)); // ancien : donnée absente → exclu
    const rides = [
      ride({ startDate: '2026-05-10T08:00:00Z', startLatlng: [45.5, 3.1] }),
      ride({ startDate: '2026-05-01T08:00:00Z', startLatlng: [48.8, 2.3] }),
    ];
    const result = await service.getRainExposure(rides);
    expect(result).toEqual({ rain_percentage: 100, rainy_rides: 1 });
  });

  it('traite une réponse HTTP en échec comme une donnée manquante', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 } as Response);
    const result = await service.getRainExposure([ride()]);
    expect(result).toEqual({ rain_percentage: 0, rainy_rides: 0 });
  });

  it('ne fait pas échouer la requête si fetch lève', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    const result = await service.getRainExposure([ride()]);
    expect(result).toEqual({ rain_percentage: 0, rainy_rides: 0 });
  });
});
```

- [ ] **Step 2 : Lancer les tests pour vérifier qu'ils échouent**

Run: `pnpm test -- profile/weather/weather.service.spec.ts`
Expected: FAIL — `Cannot find module './weather.service'`.

- [ ] **Step 3 : Écrire l'implémentation**

`backend/src/profile/weather/weather.service.ts` :

```ts
import { Injectable, Logger } from '@nestjs/common';
import type { CyclingActivity } from '../../strava/strava.types';
import type { WeatherExposure } from '../profile.types';

const ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive';
/** Au-dessus de ce cumul (mm) sur la journée, le ride est compté pluvieux. */
const RAIN_THRESHOLD_MM = 1;
/** Échantillon : les N rides géolocalisés les plus récents. */
const SAMPLE_SIZE = 60;
/** Nombre d'appels Open-Meteo lancés en parallèle. */
const CONCURRENCY = 6;

/** Sous-ensemble exploité de la réponse Open-Meteo archive. */
interface ArchiveResponse {
  daily?: {
    time?: string[];
    precipitation_sum?: (number | null)[];
  };
}

@Injectable()
export class WeatherService {
  private readonly logger = new Logger(WeatherService.name);

  /**
   * Estime l'exposition à la pluie sur un échantillon de rides récents
   * via l'API archive d'Open-Meteo. Ne fait jamais échouer l'appelant :
   * les rides sans donnée exploitable sont exclus du dénominateur.
   */
  async getRainExposure(activities: CyclingActivity[]): Promise<WeatherExposure> {
    const sample = activities
      .filter((a) => a.startLatlng != null)
      .sort(
        (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime(),
      )
      .slice(0, SAMPLE_SIZE);

    if (sample.length === 0) {
      return { rain_percentage: 0, rainy_rides: 0 };
    }

    const cache = new Map<string, number | null>();
    let rainy = 0;
    let exploitable = 0;

    for (let i = 0; i < sample.length; i += CONCURRENCY) {
      const batch = sample.slice(i, i + CONCURRENCY);
      const precipitations = await Promise.all(
        batch.map((activity) => this.precipForRide(activity, cache)),
      );
      for (const precip of precipitations) {
        if (precip == null) continue; // donnée absente → hors dénominateur
        exploitable++;
        if (precip > RAIN_THRESHOLD_MM) rainy++;
      }
    }

    if (exploitable === 0) {
      return { rain_percentage: 0, rainy_rides: 0 };
    }
    return {
      rainy_rides: rainy,
      rain_percentage: Math.round((rainy / exploitable) * 100),
    };
  }

  /** Précipitation du jour pour un ride, avec cache (clé ≈ 1 km, même jour). */
  private async precipForRide(
    activity: CyclingActivity,
    cache: Map<string, number | null>,
  ): Promise<number | null> {
    const [lat, lng] = activity.startLatlng!;
    const date = activity.startDateLocal.slice(0, 10); // YYYY-MM-DD
    const key = `${lat.toFixed(2)},${lng.toFixed(2)},${date}`;
    if (cache.has(key)) {
      return cache.get(key) ?? null;
    }
    const precip = await this.fetchPrecip(lat, lng, date);
    cache.set(key, precip);
    return precip;
  }

  /** Un appel Open-Meteo archive pour une coordonnée et un jour. */
  private async fetchPrecip(
    lat: number,
    lng: number,
    date: string,
  ): Promise<number | null> {
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lng),
      start_date: date,
      end_date: date,
      daily: 'precipitation_sum',
      timezone: 'auto',
    });

    try {
      const res = await fetch(`${ARCHIVE_URL}?${params.toString()}`);
      if (!res.ok) {
        this.logger.warn(`Open-Meteo archive a répondu ${res.status} pour ${date}.`);
        return null;
      }
      const data = (await res.json()) as ArchiveResponse;
      const value = data.daily?.precipitation_sum?.[0];
      return typeof value === 'number' ? value : null;
    } catch (err) {
      this.logger.warn(`Open-Meteo archive injoignable pour ${date}: ${String(err)}`);
      return null;
    }
  }
}
```

- [ ] **Step 4 : Lancer les tests pour vérifier qu'ils passent**

Run: `pnpm test -- profile/weather/weather.service.spec.ts`
Expected: PASS — les 8 cas verts.

- [ ] **Step 5 : Commit**

```bash
git add backend/src/profile/weather/weather.service.ts backend/src/profile/weather/weather.service.spec.ts
git commit -m "feat(profile): WeatherService — exposition pluie via Open-Meteo archive"
```

---

## Task 4 : `ProfileService` (orchestration + cache)

Orchestre cache → Strava → stats → météo → persistance. Toutes les dépendances sont mockées dans les tests.

**Files:**
- Test: `backend/src/profile/profile.service.spec.ts`
- Create: `backend/src/profile/profile.service.ts`

- [ ] **Step 1 : Écrire les tests (ils doivent échouer)**

`backend/src/profile/profile.service.spec.ts` :

```ts
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
```

- [ ] **Step 2 : Lancer les tests pour vérifier qu'ils échouent**

Run: `pnpm test -- profile/profile.service.spec.ts`
Expected: FAIL — `Cannot find module './profile.service'`.

- [ ] **Step 3 : Écrire l'implémentation**

`backend/src/profile/profile.service.ts` :

```ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StravaService } from '../strava/strava.service';
import type { User } from '../users/user.entity';
import { ProfileSnapshot } from './profile-snapshot.entity';
import { computeProfileStats } from './profile.stats';
import type { RiderProfile } from './profile.types';
import { WeatherService } from './weather/weather.service';

/** Durée de validité d'un snapshot avant recalcul. */
const TTL_MS = 12 * 60 * 60 * 1000; // 12 h

export interface GetProfileOptions {
  /** Force le recalcul même si un snapshot frais existe. */
  refresh?: boolean;
}

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(
    private readonly strava: StravaService,
    private readonly weather: WeatherService,
    @InjectRepository(ProfileSnapshot)
    private readonly snapshots: Repository<ProfileSnapshot>,
  ) {}

  /**
   * Renvoie le profil cycliste de l'utilisateur. Sert depuis le cache si le
   * snapshot est frais (< TTL) et qu'on ne force pas le refresh ; sinon,
   * recalcule depuis Strava + Open-Meteo et persiste le résultat.
   */
  async getProfile(user: User, options: GetProfileOptions = {}): Promise<RiderProfile> {
    const existing = await this.snapshots.findOne({ where: { userId: user.id } });

    if (
      existing &&
      !options.refresh &&
      Date.now() - existing.computedAt < TTL_MS
    ) {
      return JSON.parse(existing.profile) as RiderProfile;
    }

    const activities = await this.strava.getCyclingActivities(user);
    const stats = computeProfileStats(activities, user, new Date());
    const weather_exposure = await this.weather.getRainExposure(activities);
    const profile: RiderProfile = { ...stats, weather_exposure };

    await this.upsertSnapshot(user, existing, profile);
    return profile;
  }

  /** Crée ou met à jour le snapshot de cache de l'utilisateur. */
  private async upsertSnapshot(
    user: User,
    existing: ProfileSnapshot | null,
    profile: RiderProfile,
  ): Promise<void> {
    const snapshot = existing ?? this.snapshots.create({ userId: user.id });
    snapshot.profile = JSON.stringify(profile);
    snapshot.computedAt = Date.now();
    await this.snapshots.save(snapshot);
  }
}
```

- [ ] **Step 4 : Lancer les tests pour vérifier qu'ils passent**

Run: `pnpm test -- profile/profile.service.spec.ts`
Expected: PASS — les 4 cas (hit / miss / TTL expiré / refresh) verts.

- [ ] **Step 5 : Commit**

```bash
git add backend/src/profile/profile.service.ts backend/src/profile/profile.service.spec.ts
git commit -m "feat(profile): ProfileService — orchestration et cache snapshot (TTL 12h)"
```

---

## Task 5 : Câblage du module

Assemble `ProfileModule` et le branche dans `AppModule`.

**Files:**
- Create: `backend/src/profile/profile.module.ts`
- Modify: `backend/src/app.module.ts`

- [ ] **Step 1 : Créer le module**

`backend/src/profile/profile.module.ts` :

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StravaModule } from '../strava/strava.module';
import { ProfileSnapshot } from './profile-snapshot.entity';
import { ProfileService } from './profile.service';
import { WeatherService } from './weather/weather.service';

@Module({
  imports: [StravaModule, TypeOrmModule.forFeature([ProfileSnapshot])],
  providers: [ProfileService, WeatherService],
  // Exporté : le futur RecommendModule consommera ProfileService.
  exports: [ProfileService],
})
export class ProfileModule {}
```

- [ ] **Step 2 : Importer `ProfileModule` dans `AppModule`**

Dans `backend/src/app.module.ts`, ajouter l'import en haut :

```ts
import { ProfileModule } from './profile/profile.module';
```

Puis ajouter `ProfileModule` au tableau `imports` (après `StravaModule`) :

```ts
    UsersModule,
    AuthModule,
    StravaModule,
    ProfileModule,
```

- [ ] **Step 3 : Vérifier que le build passe et que le contexte Nest se résout**

Run: `pnpm build`
Expected: build OK. (Le graphe d'injection — `StravaService` via `StravaModule`, repo `ProfileSnapshot` via `TypeOrmModule.forFeature` — se résout sans `UnknownDependenciesException`.)

- [ ] **Step 4 : Lancer toute la suite de tests**

Run: `pnpm test`
Expected: PASS — `profile.stats.spec.ts`, `weather.service.spec.ts`, `profile.service.spec.ts` tous verts.

- [ ] **Step 5 : Lint**

Run: `pnpm lint`
Expected: aucune erreur.

- [ ] **Step 6 : Commit**

```bash
git add backend/src/profile/profile.module.ts backend/src/app.module.ts
git commit -m "feat(profile): câblage ProfileModule dans AppModule"
```

---

## Self-Review (déjà effectué par l'auteur du plan)

- **Couverture de la spec :**
  - Architecture `src/profile/` + sous-dossier `weather/` → Tasks 1-5. ✓
  - `RiderProfile` shape contrat → Task 1. ✓
  - Tous les agrégats (ride_count, total_distance_km, avg_speed_kmh pondérée, avg_elevation_m par sortie, monthly_distance avec mois_couverts) → Task 2, avec tests sur cas limites. ✓
  - Seuils terrain (8/18), style (28 km/h, 60 km, priorité VTT/Gravel), région → Task 2. ✓
  - `weather_exposure` : échantillon 60 récents géolocalisés, endpoint/params Open-Meteo archive confirmés, seuil 1 mm, cache clé `lat,lng,date`, concurrence 6, exclusion des jours sans donnée → Task 3. ✓
  - Cache snapshot DB 1-1, TTL 12 h, `?refresh` → Tasks 1 & 4. ✓
  - Gestion d'erreurs : 0 activité (zéros + « Données insuffisantes ») via `computeProfileStats` ; dégradation gracieuse météo (`{0,0}`, jamais d'échec) dans `WeatherService` → Tasks 2 & 3. ✓
  - Hors périmètre (moteur de reco, routes `/api/recommend` & `/api/demo`, reverse-geocoding) : volontairement absent du plan. ✓
- **Placeholders :** aucun — chaque step de code contient le code complet. ✓
- **Cohérence des types :** `RiderProfile` / `WeatherExposure` (Task 1) réutilisés tels quels par `profile.stats.ts` (`Omit<RiderProfile,'weather_exposure'>`), `WeatherService` (`WeatherExposure`) et `ProfileService`. `computeProfileStats(activities, user, now)`, `getRainExposure(activities)`, `getProfile(user, {refresh})` — signatures identiques entre définition, usage et tests. ✓
