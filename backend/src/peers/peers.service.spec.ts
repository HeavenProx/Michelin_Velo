/// <reference types="jest" />
import type { Repository } from 'typeorm';
import type { ProfileService } from '../profile/profile.service';
import type { ProfileSnapshot } from '../profile/profile-snapshot.entity';
import type { Review } from '../avis/review.entity';
import type { User } from '../users/user.entity';
import type { RiderProfile } from '../profile/profile.types';
import { PeersService } from './peers.service';

function makeProfile(overrides: Partial<RiderProfile> = {}): RiderProfile {
  return {
    ride_count: 40,
    total_distance_km: 1600,
    monthly_distance: 200,
    monthly_elevation_m: 2000,
    avg_speed_kmh: 25,
    avg_elevation_m: 300,
    terrain_label: 'Mixte',
    style_label: 'Endurance',
    weather_exposure: { rain_percentage: 25, rainy_rides: 10 },
    region: 'Paris, France',
    ...overrides,
  };
}

function makeReview(overrides: Partial<Review> = {}): Review {
  return {
    id: 1,
    userId: 2,
    tyreName: 'POWER ROAD',
    authorName: 'Bob D.',
    authorLocation: 'Paris, France',
    rating: 4,
    comment: 'Très bon pneu',
    kmAtReview: 1000,
    totalKm: 5000,
    createdAt: new Date('2026-03-01T00:00:00Z'),
    user: {
      id: 2,
      firstname: 'Bob',
      lastname: 'Durand',
      city: 'Paris',
      state: null,
    } as User,
    ...overrides,
  } as unknown as Review;
}

function makeService(
  profileOverrides: Partial<RiderProfile> = {},
  reviews: Partial<Review>[] = [],
  snapshots: Map<number, RiderProfile> = new Map(),
) {
  const profileService = {
    getProfile: jest.fn().mockResolvedValue(makeProfile(profileOverrides)),
  } as unknown as ProfileService;

  const reviewRepo = {
    find: jest.fn().mockResolvedValue(reviews),
  } as unknown as Repository<Review>;

  const snapshotRepo = {
    findOne: jest
      .fn()
      .mockImplementation(
        ({ where: { userId } }: { where: { userId: number } }) => {
          const p = snapshots.get(userId);
          if (!p) return Promise.resolve(null);
          return Promise.resolve({ profile: JSON.stringify(p) });
        },
      ),
  } as unknown as Repository<ProfileSnapshot>;

  return new PeersService(profileService, snapshotRepo, reviewRepo);
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('PeersService', () => {
  describe('getDemoPeers', () => {
    it('retourne exactement 3 pairs', () => {
      expect(makeService().getDemoPeers()).toHaveLength(3);
    });

    it('chaque pair expose les champs attendus par le front', () => {
      const [peer] = makeService().getDemoPeers();
      expect(peer).toHaveProperty('name');
      expect(peer).toHaveProperty('location');
      expect(peer).toHaveProperty('km');
      expect(peer).toHaveProperty('rating');
      expect(peer).toHaveProperty('review');
      expect(peer).toHaveProperty('similarity');
      expect(peer).toHaveProperty('tire');
      expect(peer).toHaveProperty('terrain');
    });

    it('le score de similarité est compris entre 0 et 100', () => {
      const peers = makeService().getDemoPeers();
      for (const p of peers) {
        expect(p.similarity).toBeGreaterThanOrEqual(0);
        expect(p.similarity).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('getPeers — base de données vide', () => {
    it('retombe sur les fixtures et renvoie 3 pairs', async () => {
      const peers = await makeService().getPeers({ id: 99 } as User);
      expect(peers).toHaveLength(3);
    });
  });

  describe('getPeers — peers réels en base', () => {
    it('intègre un vrai pair quand son snapshot existe', async () => {
      const snapshots = new Map<number, RiderProfile>();
      snapshots.set(
        2,
        makeProfile({ terrain_label: 'Mixte', monthly_distance: 210 }),
      );

      const service = makeService({}, [makeReview()], snapshots);
      const peers = await service.getPeers({ id: 99 } as User);

      expect(peers.length).toBeGreaterThanOrEqual(1);
      expect(peers.length).toBeLessThanOrEqual(3);
      // Le vrai pair (Bob Durand) doit apparaître sous la forme "Bob D."
      expect(peers.some((p) => p.name === 'Bob D.')).toBe(true);
    });

    it("ignore un pair s'il n'a pas de snapshot et retombe sur les fixtures", async () => {
      // Pas de snapshot pour userId=2 → le pair est ignoré
      const service = makeService({}, [makeReview()], new Map());
      const peers = await service.getPeers({ id: 99 } as User);

      // Doit retomber sur les fixtures (3 pairs)
      expect(peers).toHaveLength(3);
      expect(peers.every((p) => p.name !== 'Bob D.')).toBe(true);
    });

    it("exclut les reviews de l'utilisateur courant", async () => {
      const selfReview = makeReview({
        userId: 99,
        user: { id: 99, firstname: 'Moi', lastname: 'Même' } as User,
      });
      const service = makeService({}, [selfReview], new Map());
      const peers = await service.getPeers({ id: 99 } as User);

      // Toujours 3 fixtures (la self-review est ignorée)
      expect(peers).toHaveLength(3);
    });

    it('ne garde que la review la plus récente par utilisateur', async () => {
      const snapshots = new Map<number, RiderProfile>();
      snapshots.set(2, makeProfile());

      const older = makeReview({
        id: 1,
        userId: 2,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        tyreName: 'POWER ROAD',
      });
      const newer = makeReview({
        id: 2,
        userId: 2,
        createdAt: new Date('2026-04-01T00:00:00Z'),
        tyreName: 'POWER ALL SEASON',
      });

      const service = makeService({}, [newer, older], snapshots);
      const peers = await service.getPeers({ id: 99 } as User);

      // Un seul pair pour userId=2, basé sur la review la plus récente
      expect(peers.filter((p) => p.name === 'Bob D.')).toHaveLength(1);
      expect(peers.find((p) => p.name === 'Bob D.')?.tire).toBe(
        'POWER ALL SEASON',
      );
    });
  });

  describe('computeSimilarity — via fixtures', () => {
    it('le pair Montagne est en tête pour un profil montagne', async () => {
      const service = makeService(
        {
          terrain_label: 'Montagne',
          monthly_distance: 300,
          avg_elevation_m: 1200,
        },
        [],
        new Map(),
      );
      const peers = await service.getPeers({ id: 99 } as User);
      expect(peers[0].terrain).toContain('Montagne');
    });

    it('le pair Mixte est en tête pour un profil mixte', async () => {
      const service = makeService(
        { terrain_label: 'Mixte', monthly_distance: 300, avg_elevation_m: 500 },
        [],
        new Map(),
      );
      const peers = await service.getPeers({ id: 99 } as User);
      expect(peers[0].terrain).toContain('Mixte');
    });

    it('les scores de similarité sont triés par ordre décroissant', async () => {
      const peers = await makeService().getPeers({ id: 99 } as User);
      for (let i = 0; i < peers.length - 1; i++) {
        expect(peers[i].similarity).toBeGreaterThanOrEqual(
          peers[i + 1].similarity,
        );
      }
    });
  });
});
