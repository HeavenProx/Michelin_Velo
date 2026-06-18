/// <reference types="jest" />
import type { Repository } from 'typeorm';
import type { GarageService } from '../garage/garage.service';
import type { NotificationService } from '../notification/notification.service';
import type { Review } from '../avis/review.entity';
import type { User } from '../users/user.entity';
import { AlertsService } from './alerts.service';
import { ReviewReminder } from './review-reminder.entity';

const user = { id: 7 } as User;

interface TyreSlot {
  id: number;
  wear_percent: number;
  km_used: number;
  model: { name: string };
}

function makeTyreSlot(overrides: Partial<TyreSlot> = {}): TyreSlot {
  return {
    id: 1,
    wear_percent: 20,
    km_used: 0,
    model: { name: 'POWER ROAD' },
    ...overrides,
  };
}

function makeGarageData(tyres: TyreSlot[]) {
  return { success: true, bikes: [{ id: 1, tyres }] };
}

function makeService(
  overrides: {
    garage?: Partial<GarageService>;
    notification?: Partial<NotificationService>;
    reminderRepo?: Partial<Record<keyof Repository<ReviewReminder>, jest.Mock>>;
    reviewRepo?: Partial<Record<keyof Repository<Review>, jest.Mock>>;
  } = {},
) {
  const reminderRepo = {
    findOne: jest.fn().mockResolvedValue(null),
    create: jest
      .fn()
      .mockImplementation((d: Partial<ReviewReminder>) =>
        Object.assign(new ReviewReminder(), d),
      ),
    save: jest.fn((r: ReviewReminder) => Promise.resolve(r)),
    ...(overrides.reminderRepo ?? {}),
  } as unknown as Repository<ReviewReminder>;

  const reviewRepo = {
    existsBy: jest.fn().mockResolvedValue(false),
    ...(overrides.reviewRepo ?? {}),
  } as unknown as Repository<Review>;

  const garage = {
    getGarage: jest.fn().mockResolvedValue(makeGarageData([])),
    ...(overrides.garage ?? {}),
  } as unknown as GarageService;

  const notification = {
    sendReviewReminder: jest.fn().mockResolvedValue(true),
    ...(overrides.notification ?? {}),
  } as unknown as NotificationService;

  return new AlertsService(reminderRepo, reviewRepo, garage, notification);
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('AlertsService', () => {
  describe("alertes d'usure", () => {
    it('génère une alerte pour chaque pneu ≥ 80%', async () => {
      const service = makeService({
        garage: {
          getGarage: jest.fn().mockResolvedValue(
            makeGarageData([
              makeTyreSlot({
                wear_percent: 85,
                model: { name: 'POWER ROAD' },
              }),
              makeTyreSlot({
                id: 2,
                wear_percent: 92,
                model: { name: 'POWER ALL SEASON' },
              }),
              makeTyreSlot({
                id: 3,
                wear_percent: 60,
                model: { name: 'POWER ENDURANCE' },
              }),
            ]),
          ),
        },
      });

      const { alerts } = await service.getAlerts(user);

      expect(alerts).toHaveLength(2);
      expect(alerts.map((a) => a.tire)).toContain('POWER ROAD');
      expect(alerts.map((a) => a.tire)).toContain('POWER ALL SEASON');
    });

    it("ne génère pas d'alerte pour les pneus < 80%", async () => {
      const service = makeService({
        garage: {
          getGarage: jest
            .fn()
            .mockResolvedValue(
              makeGarageData([makeTyreSlot({ wear_percent: 79 })]),
            ),
        },
      });

      const { alerts } = await service.getAlerts(user);

      expect(alerts).toHaveLength(0);
    });

    it("retourne le taux d'usure exact dans le DTO", async () => {
      const service = makeService({
        garage: {
          getGarage: jest
            .fn()
            .mockResolvedValue(
              makeGarageData([makeTyreSlot({ wear_percent: 88 })]),
            ),
        },
      });

      const { alerts } = await service.getAlerts(user);

      expect(alerts[0].wear).toBe(88);
      expect(alerts[0].tire).toBe('POWER ROAD');
    });
  });

  describe('rappels avis', () => {
    it('crée un rappel pour chaque palier km franchi', async () => {
      const service = makeService({
        garage: {
          getGarage: jest
            .fn()
            .mockResolvedValue(
              makeGarageData([makeTyreSlot({ km_used: 1100 })]),
            ),
        },
      });

      const { reminders } = await service.getAlerts(user);

      // 1100 km → paliers 500 et 1000 franchis
      expect(reminders).toHaveLength(2);
    });

    it("n'envoie l'email qu'une seule fois (sentAt déjà défini)", async () => {
      const existingReminder = Object.assign(new ReviewReminder(), {
        id: 10,
        userId: 7,
        tyreId: 1,
        milestone: 500,
        sentAt: '2026-01-01',
        done: false,
      });
      const sendEmail = jest.fn().mockResolvedValue(true);

      const service = makeService({
        garage: {
          getGarage: jest
            .fn()
            .mockResolvedValue(
              makeGarageData([makeTyreSlot({ km_used: 600 })]),
            ),
        },
        reminderRepo: {
          findOne: jest.fn().mockResolvedValue(existingReminder),
          create: jest.fn(),
          save: jest.fn((r: ReviewReminder) => Promise.resolve(r)),
        },
        notification: { sendReviewReminder: sendEmail },
      });

      await service.getAlerts(user);

      expect(sendEmail).not.toHaveBeenCalled();
    });

    it("envoie l'email lors de la création d'un nouveau palier (sentAt null)", async () => {
      const sendEmail = jest.fn().mockResolvedValue(true);

      const service = makeService({
        garage: {
          getGarage: jest
            .fn()
            .mockResolvedValue(
              makeGarageData([makeTyreSlot({ km_used: 600 })]),
            ),
        },
        notification: { sendReviewReminder: sendEmail },
      });

      await service.getAlerts(user);

      expect(sendEmail).toHaveBeenCalledWith('POWER ROAD', 500);
    });

    it("ne pose pas de rappel si aucun palier n'est franchi", async () => {
      const service = makeService({
        garage: {
          getGarage: jest
            .fn()
            .mockResolvedValue(
              makeGarageData([makeTyreSlot({ km_used: 400 })]),
            ),
        },
      });

      const { reminders } = await service.getAlerts(user);

      expect(reminders).toHaveLength(0);
    });

    it('marque done=true quand un avis existe déjà pour ce pneu', async () => {
      const saved: ReviewReminder[] = [];

      const service = makeService({
        garage: {
          getGarage: jest
            .fn()
            .mockResolvedValue(
              makeGarageData([makeTyreSlot({ km_used: 600 })]),
            ),
        },
        reviewRepo: { existsBy: jest.fn().mockResolvedValue(true) },
        reminderRepo: {
          findOne: jest.fn().mockResolvedValue(null),
          create: jest
            .fn()
            .mockImplementation((d: Partial<ReviewReminder>) =>
              Object.assign(new ReviewReminder(), d),
            ),
          save: jest.fn((r: ReviewReminder) => {
            saved.push(r);
            return Promise.resolve(r);
          }),
        },
      });

      await service.getAlerts(user);

      expect(saved[0].done).toBe(true);
    });

    it('marque done=false quand aucun avis existe', async () => {
      const saved: ReviewReminder[] = [];

      const service = makeService({
        garage: {
          getGarage: jest
            .fn()
            .mockResolvedValue(
              makeGarageData([makeTyreSlot({ km_used: 600 })]),
            ),
        },
        reviewRepo: { existsBy: jest.fn().mockResolvedValue(false) },
        reminderRepo: {
          findOne: jest.fn().mockResolvedValue(null),
          create: jest
            .fn()
            .mockImplementation((d: Partial<ReviewReminder>) =>
              Object.assign(new ReviewReminder(), d),
            ),
          save: jest.fn((r: ReviewReminder) => {
            saved.push(r);
            return Promise.resolve(r);
          }),
        },
      });

      await service.getAlerts(user);

      expect(saved[0].done).toBe(false);
    });

    it('trie les rappels par palier décroissant', async () => {
      const service = makeService({
        garage: {
          getGarage: jest
            .fn()
            .mockResolvedValue(
              makeGarageData([makeTyreSlot({ km_used: 2500 })]),
            ),
        },
      });

      const { reminders } = await service.getAlerts(user);

      // 2500 km → paliers 500, 1000, 2000 → 3 rappels triés desc
      expect(reminders[0].threshold).toBeGreaterThanOrEqual(
        reminders[1].threshold,
      );
      expect(reminders[1].threshold).toBeGreaterThanOrEqual(
        reminders[2].threshold,
      );
    });
  });
});
