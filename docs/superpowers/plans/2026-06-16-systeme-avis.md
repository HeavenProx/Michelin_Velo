# Système d'avis — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Brancher la page Avis du frontend (aujourd'hui 100 % démo) sur un vrai backend NestJS : lecture des avis depuis SQLite et soumission persistée par l'utilisateur Strava connecté, avec contexte kilométrique calculé depuis Strava. Pas de notion d'avis vérifié.

**Architecture:** Nouveau module NestJS `avis` autonome (entité `Review` + service + contrôleur + DTO). La couture km vit dans `StravaService` (`kmRiddenSince`, réutilisable par le futur Tyre Score) ; la date de pose est résolue par un stub privé dans `AvisService` (seul point à changer quand le garage persistera la pose). Le front lit `/api/reviews` (fallback démo) et poste sur `POST /api/reviews`.

**Tech Stack:** NestJS 11, TypeORM + better-sqlite3, class-validator, Jest (back) ; React 18 + Vite + TypeScript (front). Gestionnaire **pnpm** dans chaque sous-projet.

---

## Décisions verrouillées (issues du spec + affinements)

- Spec source : `docs/superpowers/specs/2026-06-16-systeme-avis-design.md`.
- **Pas d'avis vérifié** : ni badge, ni seuil, ni gate. L'avis est toujours créé (auth seule requise).
- **`tyreName` string** (pas de FK `tyreModelId`) : le front est name-based.
- **Relation `user` `onDelete: SET NULL`** : un avis survit à la suppression du `User` et retombe sur le snapshot `authorName`/`authorLocation`.
- **Résolution auteur à la lecture** : si `review.user` existe → infos courantes du `User` ; sinon → colonnes snapshot.
- **`kmRiddenSince`** dans `StravaService` ; **`resolveMountDate`** stub privé dans `AvisService` (renvoie aujourd'hui − 90 j).
- **`totalKm`** = `ProfileService.getProfile(user).total_distance_km` (snapshot mis en cache) ; **`kmAtReview`** = `kmRiddenSince(user, mountDate)`.

## Structure des fichiers

**Back — créés :**
- `backend/src/avis/review.entity.ts` — entité TypeORM `Review`.
- `backend/src/avis/dto/create-review.dto.ts` — validation du corps `POST`.
- `backend/src/avis/avis.service.ts` — lecture (mapping + résolution auteur), création (upsert + calcul km), `resolveMountDate`, `toReviewDto`, `formatFrenchDate`.
- `backend/src/avis/avis.service.spec.ts` — tests unitaires du service.
- `backend/src/avis/avis.controller.ts` — routes `GET`/`POST /api/reviews`.
- `backend/src/avis/avis.module.ts` — câblage du module.
- `backend/scripts/seed-reviews.ts` — seed des 7 avis démo.

**Back — modifiés :**
- `backend/src/strava/strava.service.ts` — ajout `kmRiddenSince`.
- `backend/src/strava/strava.service.spec.ts` — tests de `kmRiddenSince`.
- `backend/src/app.module.ts` — enregistrer `Review` (entities) + `AvisModule` (imports).
- `backend/package.json` — script `seed:reviews`.

**Front — modifiés :**
- `frontend/src/types.ts` — interface `Review`.
- `frontend/src/pages/AvisPage.tsx` — fetch `/api/reviews` + fallback démo, retrait copie « vérifiés ».
- `frontend/src/components/ReviewModal.tsx` — soumission réelle `POST` + gestion succès/erreur + callback `onSubmitted`.

---

## Task 1: `kmRiddenSince` dans StravaService

**Files:**
- Modify: `backend/src/strava/strava.service.ts`
- Test: `backend/src/strava/strava.service.spec.ts`

- [ ] **Step 1: Écrire le test qui échoue**

Ajouter dans `strava.service.spec.ts`, à l'intérieur du `describe('StravaService', ...)`, un nouveau bloc :

```ts
  describe('kmRiddenSince', () => {
    it('somme les distances des activités postérieures à la date donnée', async () => {
      const since = new Date('2026-05-01T00:00:00Z');
      jest.spyOn(service, 'getCyclingActivities').mockResolvedValue([
        { distanceKm: 30, startDate: '2026-05-02T08:00:00Z' },
        { distanceKm: 20, startDate: '2026-05-10T08:00:00Z' },
        { distanceKm: 99, startDate: '2026-04-15T08:00:00Z' }, // avant `since` → exclue
      ] as never);

      const km = await service.kmRiddenSince(makeUser(), since);

      expect(km).toBe(50);
    });

    it('arrondit à l’entier le plus proche', async () => {
      jest.spyOn(service, 'getCyclingActivities').mockResolvedValue([
        { distanceKm: 12.4, startDate: '2026-06-01T08:00:00Z' },
        { distanceKm: 7.3, startDate: '2026-06-02T08:00:00Z' },
      ] as never);

      const km = await service.kmRiddenSince(makeUser(), new Date('2026-01-01T00:00:00Z'));

      expect(km).toBe(20);
    });
  });
```

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

Run: `cd backend && pnpm jest strava.service -t kmRiddenSince`
Expected: FAIL — `service.kmRiddenSince is not a function`.

- [ ] **Step 3: Implémenter la méthode**

Dans `backend/src/strava/strava.service.ts`, ajouter cette méthode publique dans la classe `StravaService` (juste après `getCyclingActivities`) :

```ts
  /**
   * Total des kilomètres vélo parcourus depuis `since` (calcul Strava réel).
   * Réutilisable par le futur Tyre Score.
   */
  async kmRiddenSince(user: User, since: Date): Promise<number> {
    const sinceDays = Math.max(
      1,
      Math.ceil((Date.now() - since.getTime()) / 86_400_000),
    );
    const activities = await this.getCyclingActivities(user, {
      sinceDays,
      maxActivities: 1000,
    });
    const sinceMs = since.getTime();
    const km = activities
      .filter((a) => new Date(a.startDate).getTime() >= sinceMs)
      .reduce((sum, a) => sum + a.distanceKm, 0);
    return Math.round(km);
  }
```

- [ ] **Step 4: Lancer le test pour vérifier le succès**

Run: `cd backend && pnpm jest strava.service -t kmRiddenSince`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/strava/strava.service.ts backend/src/strava/strava.service.spec.ts
git commit -m "feat(strava): kmRiddenSince pour le contexte km des avis"
```

---

## Task 2: Entité `Review`

**Files:**
- Create: `backend/src/avis/review.entity.ts`

- [ ] **Step 1: Créer l'entité**

Créer `backend/src/avis/review.entity.ts` :

```ts
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

/**
 * Avis utilisateur sur un modèle de pneu (référencé par son nom — le front est name-based).
 * `userId` nullable : null pour les avis démo seedés. À la lecture, si `user` est présent,
 * ses infos priment sur le snapshot `authorName`/`authorLocation`.
 */
@Entity('reviews')
@Index(['userId', 'tyreName'], { unique: true })
export class Review {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user!: User | null;

  @Column({ name: 'user_id', type: 'integer', nullable: true })
  userId!: number | null;

  @Column({ name: 'tyre_name', type: 'text' })
  tyreName!: string;

  /** Snapshot auteur — fallback quand `user` est null (seeds / user supprimé). */
  @Column({ name: 'author_name', type: 'text' })
  authorName!: string;

  @Column({ name: 'author_location', type: 'text' })
  authorLocation!: string;

  @Column({ type: 'integer' })
  rating!: number;

  @Column({ name: 'grip_score', type: 'integer' })
  gripScore!: number;

  @Column({ name: 'durability_score', type: 'integer' })
  durabilityScore!: number;

  @Column({ name: 'comfort_score', type: 'integer' })
  comfortScore!: number;

  @Column({ name: 'puncture_score', type: 'integer' })
  punctureScore!: number;

  @Column({ type: 'text', default: '' })
  comment!: string;

  /** Date de pose résolue (stub aujourd'hui ; garage demain). Non affichée. */
  @Column({ name: 'mount_date', type: 'datetime' })
  mountDate!: Date;

  /** Km parcourus sur le pneu au moment de l'avis. */
  @Column({ name: 'km_at_review', type: 'integer' })
  kmAtReview!: number;

  /** Km total du cycliste. */
  @Column({ name: 'total_km', type: 'integer' })
  totalKm!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
```

- [ ] **Step 2: Vérifier la compilation**

Run: `cd backend && pnpm exec tsc --noEmit`
Expected: aucune erreur sur `review.entity.ts` (le module n'est pas encore câblé, c'est normal).

- [ ] **Step 3: Commit**

```bash
git add backend/src/avis/review.entity.ts
git commit -m "feat(avis): entite Review"
```

---

## Task 3: DTO `CreateReviewDto`

**Files:**
- Create: `backend/src/avis/dto/create-review.dto.ts`

- [ ] **Step 1: Créer le DTO**

Créer `backend/src/avis/dto/create-review.dto.ts` :

```ts
import { IsInt, IsString, Max, MaxLength, Min } from 'class-validator';

/** Corps attendu par POST /api/reviews. Clés critères alignées sur le front. */
export class CreateReviewDto {
  @IsString()
  tire!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsInt()
  @Min(1)
  @Max(5)
  grip!: number;

  @IsInt()
  @Min(1)
  @Max(5)
  durabilite!: number;

  @IsInt()
  @Min(1)
  @Max(5)
  confort!: number;

  @IsInt()
  @Min(1)
  @Max(5)
  anticrv!: number;

  @IsString()
  @MaxLength(2000)
  comment!: string;
}
```

- [ ] **Step 2: Vérifier la compilation**

Run: `cd backend && pnpm exec tsc --noEmit`
Expected: aucune erreur sur `create-review.dto.ts`.

- [ ] **Step 3: Commit**

```bash
git add backend/src/avis/dto/create-review.dto.ts
git commit -m "feat(avis): CreateReviewDto"
```

---

## Task 4: `AvisService` (lecture, création, mapping)

**Files:**
- Create: `backend/src/avis/avis.service.ts`
- Test: `backend/src/avis/avis.service.spec.ts`

- [ ] **Step 1: Écrire les tests qui échouent**

Créer `backend/src/avis/avis.service.spec.ts` :

```ts
/// <reference types="jest" />
import type { Repository } from 'typeorm';
import type { ProfileService } from '../profile/profile.service';
import type { StravaService } from '../strava/strava.service';
import type { User } from '../users/user.entity';
import { AvisService } from './avis.service';
import type { Review } from './review.entity';

function makeUser(): User {
  return {
    id: 7,
    firstname: 'Jean',
    lastname: 'Dupont',
    city: 'Lyon',
    state: 'Rhône',
  } as User;
}

describe('AvisService', () => {
  let service: AvisService;
  let repo: { find: jest.Mock; findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  let strava: { kmRiddenSince: jest.Mock };
  let profile: { getProfile: jest.Mock };

  beforeEach(() => {
    repo = { find: jest.fn(), findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
    strava = { kmRiddenSince: jest.fn() };
    profile = { getProfile: jest.fn() };
    service = new AvisService(
      repo as unknown as Repository<Review>,
      strava as unknown as StravaService,
      profile as unknown as ProfileService,
    );
  });

  describe('listReviews', () => {
    it('mappe une review au shape front et privilégie les infos du User présent', async () => {
      repo.find.mockResolvedValue([
        {
          id: 1,
          user: { firstname: 'Élodie', lastname: 'Martin', city: 'Annecy', state: 'Haute-Savoie' },
          userId: 3,
          tyreName: 'Power Road',
          authorName: 'SNAPSHOT IGNORÉ',
          authorLocation: 'SNAPSHOT IGNORÉ',
          rating: 5,
          gripScore: 5,
          durabilityScore: 4,
          comfortScore: 5,
          punctureScore: 5,
          comment: 'Top',
          kmAtReview: 2840,
          totalKm: 8420,
          createdAt: new Date('2026-04-12T00:00:00Z'),
        },
      ]);

      const [dto] = await service.listReviews('Power Road');

      expect(dto).toEqual({
        id: 1,
        name: 'Élodie M.',
        location: 'Annecy, Haute-Savoie',
        tire: 'Power Road',
        km: 2840,
        totalKm: 8420,
        rating: 5,
        text: 'Top',
        date: '12 avril 2026',
        criteria: { grip: 5, durabilite: 4, confort: 5, anticrv: 5 },
      });
    });

    it('retombe sur le snapshot auteur quand user est null (avis démo)', async () => {
      repo.find.mockResolvedValue([
        {
          id: 2,
          user: null,
          userId: null,
          tyreName: 'Power Road',
          authorName: 'Kevin T.',
          authorLocation: 'Nice, Alpes-Maritimes',
          rating: 4,
          gripScore: 4,
          durabilityScore: 4,
          comfortScore: 4,
          punctureScore: 3,
          comment: 'Bien',
          kmAtReview: 2600,
          totalKm: 6200,
          createdAt: new Date('2026-02-14T00:00:00Z'),
        },
      ]);

      const [dto] = await service.listReviews();

      expect(dto.name).toBe('Kevin T.');
      expect(dto.location).toBe('Nice, Alpes-Maritimes');
    });
  });

  describe('createReview', () => {
    it('calcule km/totalKm, snapshote l’auteur et sauvegarde', async () => {
      strava.kmRiddenSince.mockResolvedValue(640);
      profile.getProfile.mockResolvedValue({ total_distance_km: 5120 });
      repo.findOne.mockResolvedValue(null);
      repo.create.mockReturnValue({});
      repo.save.mockImplementation((r: Review) => Promise.resolve({ ...r, id: 99 }));

      const dto = await service.createReview(makeUser(), {
        tire: 'Power Road',
        rating: 5,
        grip: 5,
        durabilite: 4,
        confort: 5,
        anticrv: 4,
        comment: 'Super pneu',
      });

      const saved = repo.save.mock.calls[0][0] as Review;
      expect(saved.userId).toBe(7);
      expect(saved.tyreName).toBe('Power Road');
      expect(saved.authorName).toBe('Jean D.');
      expect(saved.authorLocation).toBe('Lyon, Rhône');
      expect(saved.kmAtReview).toBe(640);
      expect(saved.totalKm).toBe(5120);
      expect(saved.gripScore).toBe(5);
      expect(saved.punctureScore).toBe(4);
      expect(dto.id).toBe(99);
      expect(dto.name).toBe('Jean D.');
    });

    it('met à jour l’avis existant (upsert) au lieu d’en créer un second', async () => {
      strava.kmRiddenSince.mockResolvedValue(100);
      profile.getProfile.mockResolvedValue({ total_distance_km: 1000 });
      repo.findOne.mockResolvedValue({ id: 42 });
      repo.save.mockImplementation((r: Review) => Promise.resolve(r));

      await service.createReview(makeUser(), {
        tire: 'Power Road',
        rating: 3,
        grip: 3,
        durabilite: 3,
        confort: 3,
        anticrv: 3,
        comment: 'Mise à jour',
      });

      expect(repo.create).not.toHaveBeenCalled();
      expect((repo.save.mock.calls[0][0] as Review).id).toBe(42);
    });
  });
});
```

- [ ] **Step 2: Lancer les tests pour vérifier l'échec**

Run: `cd backend && pnpm jest avis.service`
Expected: FAIL — `Cannot find module './avis.service'`.

- [ ] **Step 3: Implémenter le service**

Créer `backend/src/avis/avis.service.ts` :

```ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProfileService } from '../profile/profile.service';
import { StravaService } from '../strava/strava.service';
import type { User } from '../users/user.entity';
import type { CreateReviewDto } from './dto/create-review.dto';
import { Review } from './review.entity';

/** Avis au format attendu par le frontend (frontend/src/pages/AvisPage.tsx). */
export interface ReviewDto {
  id: number;
  name: string;
  location: string;
  tire: string;
  km: number;
  totalKm: number;
  rating: number;
  text: string;
  date: string;
  criteria: { grip: number; durabilite: number; confort: number; anticrv: number };
}

const FR_DATE = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

function displayName(firstname: string, lastname: string): string {
  const initial = lastname?.charAt(0) ?? '';
  return initial ? `${firstname} ${initial}.` : firstname;
}

function toReviewDto(r: Review): ReviewDto {
  const name = r.user
    ? displayName(r.user.firstname, r.user.lastname)
    : r.authorName;
  const location = r.user
    ? [r.user.city, r.user.state].filter(Boolean).join(', ')
    : r.authorLocation;
  return {
    id: r.id,
    name,
    location,
    tire: r.tyreName,
    km: r.kmAtReview,
    totalKm: r.totalKm,
    rating: r.rating,
    text: r.comment,
    date: FR_DATE.format(new Date(r.createdAt)),
    criteria: {
      grip: r.gripScore,
      durabilite: r.durabilityScore,
      confort: r.comfortScore,
      anticrv: r.punctureScore,
    },
  };
}

@Injectable()
export class AvisService {
  constructor(
    @InjectRepository(Review)
    private readonly reviews: Repository<Review>,
    private readonly strava: StravaService,
    private readonly profile: ProfileService,
  ) {}

  /** Liste les avis, optionnellement filtrés par nom de modèle. */
  async listReviews(tire?: string): Promise<ReviewDto[]> {
    const where = tire && tire !== 'Tous' ? { tyreName: tire } : {};
    const rows = await this.reviews.find({
      where,
      relations: { user: true },
      order: { createdAt: 'DESC' },
    });
    return rows.map(toReviewDto);
  }

  /** Crée ou met à jour (upsert) l'avis de l'utilisateur sur ce modèle. */
  async createReview(user: User, dto: CreateReviewDto): Promise<ReviewDto> {
    const mountDate = this.resolveMountDate(user.id, dto.tire);
    const kmAtReview = await this.strava.kmRiddenSince(user, mountDate);
    const riderProfile = await this.profile.getProfile(user);
    const totalKm = Math.round(riderProfile.total_distance_km);

    const existing = await this.reviews.findOne({
      where: { userId: user.id, tyreName: dto.tire },
    });
    const review = existing ?? this.reviews.create();

    review.userId = user.id;
    review.tyreName = dto.tire;
    review.authorName = displayName(user.firstname, user.lastname);
    review.authorLocation = [user.city, user.state].filter(Boolean).join(', ');
    review.rating = dto.rating;
    review.gripScore = dto.grip;
    review.durabilityScore = dto.durabilite;
    review.comfortScore = dto.confort;
    review.punctureScore = dto.anticrv;
    review.comment = dto.comment;
    review.mountDate = mountDate;
    review.kmAtReview = kmAtReview;
    review.totalKm = totalKm;

    const saved = await this.reviews.save(review);
    saved.user = user;
    return toReviewDto(saved);
  }

  /**
   * Date de pose du pneu pour ce couple (user, modèle).
   * STUB : renvoie aujourd'hui − 90 jours.
   * TODO: lire la date de pose persistée (garage) quand le Tyre Score back existera.
   * C'est le SEUL endroit à changer pour brancher le garage.
   */
  private resolveMountDate(_userId: number, _tyreName: string): Date {
    return new Date(Date.now() - 90 * 86_400_000);
  }
}
```

- [ ] **Step 4: Lancer les tests pour vérifier le succès**

Run: `cd backend && pnpm jest avis.service`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/avis/avis.service.ts backend/src/avis/avis.service.spec.ts
git commit -m "feat(avis): AvisService lecture + creation (upsert) avec contexte km"
```

---

## Task 5: `AvisController`

**Files:**
- Create: `backend/src/avis/avis.controller.ts`

- [ ] **Step 1: Créer le contrôleur**

Créer `backend/src/avis/avis.controller.ts` :

```ts
import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthenticatedGuard } from '../auth/authenticated.guard';
import { AvisService } from './avis.service';
import { CreateReviewDto } from './dto/create-review.dto';

@Controller('api')
export class AvisController {
  constructor(private readonly avis: AvisService) {}

  /** Lecture publique : alimente la page Avis (réelle + démo) sans auth. */
  @Get('reviews')
  list(@Query('tire') tire?: string) {
    return this.avis.listReviews(tire);
  }

  /** Soumission : auth requise, aucune condition de kilométrage. */
  @Post('reviews')
  @UseGuards(AuthenticatedGuard)
  create(@Req() req: Request, @Body() dto: CreateReviewDto) {
    if (!req.user) throw new UnauthorizedException();
    return this.avis.createReview(req.user, dto);
  }
}
```

- [ ] **Step 2: Vérifier la compilation**

Run: `cd backend && pnpm exec tsc --noEmit`
Expected: aucune erreur sur `avis.controller.ts`.

- [ ] **Step 3: Commit**

```bash
git add backend/src/avis/avis.controller.ts
git commit -m "feat(avis): AvisController routes /api/reviews"
```

---

## Task 6: `AvisModule` + enregistrement dans `AppModule`

**Files:**
- Create: `backend/src/avis/avis.module.ts`
- Modify: `backend/src/app.module.ts`

- [ ] **Step 1: Créer le module**

Créer `backend/src/avis/avis.module.ts` :

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { ProfileModule } from '../profile/profile.module';
import { StravaModule } from '../strava/strava.module';
import { AvisController } from './avis.controller';
import { AvisService } from './avis.service';
import { Review } from './review.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Review]),
    StravaModule,
    ProfileModule,
    AuthModule,
  ],
  controllers: [AvisController],
  providers: [AvisService],
})
export class AvisModule {}
```

- [ ] **Step 2: Vérifier que ProfileModule exporte ProfileService**

Run: `cd backend && grep -n "exports" src/profile/profile.module.ts`
Expected: une ligne `exports: [...]` contenant `ProfileService`. **Si absent**, ajouter `ProfileService` au tableau `exports` de `profile.module.ts`, puis committer ce fix séparément.

- [ ] **Step 3: Enregistrer l'entité et le module dans `app.module.ts`**

Dans `backend/src/app.module.ts` :

Ajouter les imports en haut (à côté des autres) :

```ts
import { AvisModule } from './avis/avis.module';
import { Review } from './avis/review.entity';
```

Ajouter `Review` au tableau `entities` :

```ts
        entities: [User, TyreModel, TyreSize, ProfileSnapshot, Review],
```

Ajouter `AvisModule` au tableau `imports` (après `RecommendModule`) :

```ts
    RecommendModule,
    AvisModule,
```

- [ ] **Step 4: Vérifier le build et le démarrage**

Run: `cd backend && pnpm build`
Expected: build OK, aucune erreur.

Run (démarrage à blanc, on coupe après le log d'écoute) : `cd backend && pnpm start:dev`
Expected: l'app démarre, log « Nest application successfully started », aucune erreur de dépendance (table `reviews` créée par `synchronize`). Couper avec Ctrl-C.

- [ ] **Step 5: Vérifier la route en lecture (table vide)**

Avec l'app lancée, dans un autre terminal :
Run: `curl -s http://localhost:3001/api/reviews`
Expected: `[]` (HTTP 200, tableau vide — pas encore de seed).

- [ ] **Step 6: Commit**

```bash
git add backend/src/avis/avis.module.ts backend/src/app.module.ts
git commit -m "feat(avis): AvisModule cable dans AppModule"
```

---

## Task 7: Seed des 7 avis démo

**Files:**
- Create: `backend/scripts/seed-reviews.ts`
- Modify: `backend/package.json`

- [ ] **Step 1: Créer le script de seed**

Créer `backend/scripts/seed-reviews.ts`. Il bootstrappe le contexte Nest (schéma garanti identique à l'entité via `synchronize`) et insère les 7 avis (`userId = null`, snapshot auteur en dur) si la table est vide :

```ts
/**
 * Seed des avis démo (frontend/src/data/demo.ts → REVIEWS).
 * Usage : cd backend && pnpm seed:reviews
 * Idempotent : ne fait rien si la table contient déjà des avis.
 */
import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Review } from '../src/avis/review.entity';

interface SeedRow {
  authorName: string;
  authorLocation: string;
  tyreName: string;
  kmAtReview: number;
  totalKm: number;
  rating: number;
  comment: string;
  createdAt: string; // ISO
  grip: number;
  durabilite: number;
  confort: number;
  anticrv: number;
}

const SEED: SeedRow[] = [
  { authorName: 'Élodie M.', authorLocation: 'Annecy, Haute-Savoie', tyreName: 'Power All Season TLR', kmAtReview: 2840, totalKm: 8420, rating: 5, comment: "Grip incroyable même sous la pluie en descente du Galibier. Je ne m'attendais pas à autant de confiance sur le mouillé.", createdAt: '2026-04-12', grip: 5, durabilite: 4, confort: 5, anticrv: 5 },
  { authorName: 'Marc-Antoine D.', authorLocation: 'Lyon, Rhône', tyreName: 'Power All Season TLR', kmAtReview: 4100, totalKm: 12300, rating: 4, comment: "4 000 km et la bande de roulement est encore très correcte. Un peu cher mais ça vaut le coup sur la durée.", createdAt: '2026-03-28', grip: 4, durabilite: 5, confort: 4, anticrv: 4 },
  { authorName: 'Lucie B.', authorLocation: 'Chambéry, Savoie', tyreName: 'Power All Season TLR', kmAtReview: 1920, totalKm: 5760, rating: 5, comment: "Je roulais avec une autre marque avant. La différence se sent immédiatement dans les virages mouillés.", createdAt: '2026-05-02', grip: 5, durabilite: 4, confort: 5, anticrv: 5 },
  { authorName: 'Thomas G.', authorLocation: 'Lyon, Rhône', tyreName: 'Power All Season TLR', kmAtReview: 3800, totalKm: 9500, rating: 5, comment: "Mon pneu de référence depuis 2 saisons. Polyvalence remarquable, rien à redire.", createdAt: '2026-05-05', grip: 5, durabilite: 5, confort: 5, anticrv: 5 },
  { authorName: 'Kevin T.', authorLocation: 'Nice, Alpes-Maritimes', tyreName: 'Power Road', kmAtReview: 3200, totalKm: 7680, rating: 5, comment: "La résistance au roulement est vraiment faible, on gagne facilement 1–2 km/h sur le plat. Excellent en conditions sèches.", createdAt: '2026-04-18', grip: 5, durabilite: 4, confort: 4, anticrv: 4 },
  { authorName: 'Sébastien R.', authorLocation: 'Bordeaux, Gironde', tyreName: 'Power Road', kmAtReview: 2600, totalKm: 6200, rating: 4, comment: "Pneu très performant en conditions sèches. Un peu moins à l'aise sous la pluie mais reste très utilisable.", createdAt: '2026-02-14', grip: 4, durabilite: 4, confort: 4, anticrv: 3 },
  { authorName: 'Aurélie F.', authorLocation: 'Grenoble, Isère', tyreName: 'Pro4 Endurance', kmAtReview: 5200, totalKm: 11800, rating: 5, comment: "Impressionnant en termes de durabilité. Encore utilisable après 5 000 km, c'est incroyable.", createdAt: '2026-03-03', grip: 4, durabilite: 5, confort: 5, anticrv: 5 },
];

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const repo = app.get<Repository<Review>>(getRepositoryToken(Review));

  const count = await repo.count();
  if (count > 0) {
    console.log(`Table reviews déjà peuplée (${count} avis) — seed ignoré.`);
    await app.close();
    return;
  }

  const rows = SEED.map((s) =>
    repo.create({
      user: null,
      userId: null,
      tyreName: s.tyreName,
      authorName: s.authorName,
      authorLocation: s.authorLocation,
      rating: s.rating,
      gripScore: s.grip,
      durabilityScore: s.durabilite,
      comfortScore: s.confort,
      punctureScore: s.anticrv,
      comment: s.comment,
      mountDate: new Date(s.createdAt),
      kmAtReview: s.kmAtReview,
      totalKm: s.totalKm,
      createdAt: new Date(s.createdAt),
    }),
  );

  await repo.save(rows);
  console.log(`${rows.length} avis démo insérés.`);
  await app.close();
}

void main();
```

- [ ] **Step 2: Ajouter le script pnpm**

Dans `backend/package.json`, sous `"scripts"`, remplacer la ligne `"import:tyres"` par les deux lignes suivantes (attention à la virgule) :

```json
    "import:tyres": "tsx scripts/import-tyres.ts",
    "seed:reviews": "tsx scripts/seed-reviews.ts"
```

- [ ] **Step 3: Lancer le seed**

Run: `cd backend && pnpm seed:reviews`
Expected: log `7 avis démo insérés.`

- [ ] **Step 4: Vérifier les données via l'API**

Démarrer l'app (`pnpm start:dev`), puis :
Run: `curl -s http://localhost:3001/api/reviews`
Expected: tableau de 7 avis, chacun avec `date` formatée en français (ex. « 5 mai 2026 »), tri `createdAt` desc (Thomas G. en tête).

Run (filtre): `curl -s "http://localhost:3001/api/reviews?tire=Power%20Road"`
Expected: 2 avis (Kevin T., Sébastien R.).

- [ ] **Step 5: Commit**

```bash
git add backend/scripts/seed-reviews.ts backend/package.json
git commit -m "feat(avis): script de seed des avis demo"
```

---

## Task 8: Front — lecture des avis depuis l'API

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/pages/AvisPage.tsx`

- [ ] **Step 1: Ajouter l'interface `Review` aux types**

Dans `frontend/src/types.ts`, ajouter à la fin :

```ts
export interface Review {
  id: number;
  name: string;
  location: string;
  tire: string;
  km: number;
  totalKm: number;
  rating: number;
  text: string;
  date: string;
  criteria: { grip: number; durabilite: number; confort: number; anticrv: number };
}
```

- [ ] **Step 2: Brancher le fetch dans `AvisPage` (fallback démo)**

Dans `frontend/src/pages/AvisPage.tsx` :

Remplacer la ligne d'import de React :

```ts
import { useState } from "react";
```

par :

```ts
import { useCallback, useEffect, useState } from "react";
```

Ajouter l'import du type (à côté des imports existants) :

```ts
import type { Review } from "@/types";
```

Juste après la ligne `const [showModal, setShowModal] = useState(false);`, ajouter l'état + le chargement :

```ts
  const [reviews, setReviews] = useState<Review[]>(REVIEWS);

  const loadReviews = useCallback(() => {
    fetch("/api/reviews", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("HTTP error"))))
      .then((data: Review[]) => {
        if (Array.isArray(data) && data.length > 0) setReviews(data);
      })
      .catch(() => {
        /* fallback silencieux sur les données démo (convention projet) */
      });
  }, []);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);
```

Remplacer **toutes** les occurrences restantes de `REVIEWS` (dans `tireStats`, `filtered`, et l'en-tête `{REVIEWS.length}`) par `reviews`. Concrètement :
- `const tireStats = Array.from(new Set(REVIEWS.map(...)))` → `reviews.map`
- `const subset = REVIEWS.filter(...)` → `reviews.filter(...)`
- `const filtered = filter === "Tous" ? REVIEWS : REVIEWS.filter(...)` → `reviews ... reviews.filter(...)`
- `{ tire: "Tous", count: REVIEWS.length, ... }` → `count: reviews.length`
- (l'en-tête `{REVIEWS.length} avis vérifiés` est traité au Task 10)

(L'import `REVIEWS` reste utilisé comme valeur initiale de `useState`, donc on le garde.)

- [ ] **Step 3: Vérifier le build**

Run: `cd frontend && pnpm build`
Expected: build OK (tsc + vite), aucune erreur de type.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types.ts frontend/src/pages/AvisPage.tsx
git commit -m "feat(avis): lecture des avis via /api/reviews avec fallback demo"
```

---

## Task 9: Front — soumission réelle d'un avis

**Files:**
- Modify: `frontend/src/components/ReviewModal.tsx`
- Modify: `frontend/src/pages/AvisPage.tsx`

- [ ] **Step 1: Brancher le POST dans `ReviewModal`**

Dans `frontend/src/components/ReviewModal.tsx` :

Étendre la signature des props pour accepter un callback optionnel :

```ts
export function ReviewModal({
  open,
  onClose,
  tireName,
  onSubmitted,
}: {
  open: boolean;
  onClose: () => void;
  tireName: string;
  onSubmitted?: () => void;
}) {
```

Ajouter un état d'erreur, à côté des autres `useState` :

```ts
  const [error, setError] = useState("");
```

Remplacer la fonction `submit` par une version asynchrone qui poste :

```ts
  async function submit() {
    if (!rating) return;
    setError("");
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tire: tireName,
          rating,
          grip: criteria.grip,
          durabilite: criteria.durabilite,
          confort: criteria.confort,
          anticrv: criteria.anticrv,
          comment,
        }),
      });
      if (!res.ok) {
        setError(
          res.status === 401
            ? "Connectez-vous via Strava pour publier votre avis."
            : "Une erreur est survenue. Réessayez.",
        );
        return;
      }
    } catch {
      setError("Une erreur est survenue. Réessayez.");
      return;
    }
    onSubmitted?.();
    setDone(true);
    setTimeout(() => {
      onClose();
      setDone(false);
      setRating(0);
      setCriteria({ grip: 0, durabilite: 0, confort: 0, anticrv: 0 });
      setComment("");
      setError("");
    }, 1800);
  }
```

Afficher le message d'erreur : juste avant le bloc des deux boutons (`<div className="flex gap-3">`), insérer :

```tsx
            {error && (
              <p className="text-sm text-red-600 mb-3">{error}</p>
            )}
```

- [ ] **Step 2: Rafraîchir la liste après soumission depuis `AvisPage`**

Dans `frontend/src/pages/AvisPage.tsx`, passer le callback au modal. Remplacer :

```tsx
      <ReviewModal open={showModal} onClose={() => setShowModal(false)} tireName={MY_TIRE} />
```

par :

```tsx
      <ReviewModal
        open={showModal}
        onClose={() => setShowModal(false)}
        tireName={MY_TIRE}
        onSubmitted={loadReviews}
      />
```

- [ ] **Step 3: Vérifier le build**

Run: `cd frontend && pnpm build`
Expected: build OK. (`GaragePage` utilise toujours `ReviewModal` sans `onSubmitted` → prop optionnelle, pas d'erreur.)

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ReviewModal.tsx frontend/src/pages/AvisPage.tsx
git commit -m "feat(avis): soumission reelle d'un avis via POST /api/reviews"
```

---

## Task 10: Front — retrait de la copie « avis vérifié »

**Files:**
- Modify: `frontend/src/pages/AvisPage.tsx`

- [ ] **Step 1: Mettre à jour les libellés**

Dans `frontend/src/pages/AvisPage.tsx` :

Titre — remplacer :

```tsx
          <h1 className="text-2xl font-bold text-gray-900">Avis vérifiés</h1>
          <p className="text-sm text-gray-400 mt-0.5">{REVIEWS.length} avis vérifiés</p>
```

par :

```tsx
          <h1 className="text-2xl font-bold text-gray-900">Avis</h1>
          <p className="text-sm text-gray-400 mt-0.5">{reviews.length} avis</p>
```

Note explicative sous l'en-tête — remplacer :

```tsx
        Les avis affichés par défaut portent sur votre pneu actuel. N&apos;hésitez pas à appliquer un filtre si vous souhaitez consulter les avis sur d&apos;autres pneus.
```

(inchangée — elle ne mentionne pas la vérification, la laisser telle quelle.)

Bloc CTA — remplacer :

```tsx
        <p className="text-sm text-gray-600 mb-0.5">Vous avez parcouru 2 840 km sur vos {MY_TIRE}.</p>
        <p className="text-xs text-gray-400 mb-4">Seuil requis pour laisser un avis : 500 km ✓</p>
```

par :

```tsx
        <p className="text-sm text-gray-600 mb-0.5">Partagez votre expérience sur vos {MY_TIRE}.</p>
        <p className="text-xs text-gray-400 mb-4">Votre avis aide la communauté.</p>
```

Bouton CTA — remplacer le libellé `Laisser un avis vérifié` par `Laisser un avis`.

- [ ] **Step 2: Vérifier qu'aucune mention « vérifié » ne subsiste**

Run: `cd frontend && grep -rni "vérifié\|verifie\|seuil requis" src/pages/AvisPage.tsx`
Expected: aucune correspondance.

- [ ] **Step 3: Vérifier le build**

Run: `cd frontend && pnpm build`
Expected: build OK.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/AvisPage.tsx
git commit -m "refactor(avis): retrait de la copie 'avis verifie' cote front"
```

---

## Vérification finale (end-to-end manuel)

- [ ] **Backend up + seedé** : `cd backend && pnpm seed:reviews && pnpm start:dev`
- [ ] **Frontend up** : `cd frontend && pnpm dev`
- [ ] Sur la page Avis : les 7 avis s'affichent (données réelles de l'API — vérifier dans l'onglet Réseau que `/api/reviews` renvoie 200 avec 7 items).
- [ ] Le filtre par modèle fonctionne (« Power Road » → 2 avis).
- [ ] Non connecté : « Laisser un avis » → publier affiche « Connectez-vous via Strava… ».
- [ ] Connecté via Strava : publier un avis → message de remerciement, l'avis apparaît en tête de liste (tri desc), avec le nom dérivé du compte Strava et le contexte km calculé.
- [ ] Re-publier sur le même modèle → met à jour l'avis existant (pas de doublon).
- [ ] `cd backend && pnpm test` → tous les tests passent.

---

## Notes pour le futur (hors périmètre)

- **Branchement garage** : quand le Tyre Score back persistera la date de pose, modifier **uniquement** `AvisService.resolveMountDate` pour lire cette date au lieu du stub `− 90 j`. Le reste du module ne bouge pas.
- Modération, votes « utile », photos, pagination : non implémentés (YAGNI hackathon).
