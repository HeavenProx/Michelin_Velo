# Système d'avis — Design

**Date :** 2026-06-16
**Statut :** validé en brainstorming, prêt pour plan d'implémentation
**Périmètre choisi :** système d'avis complet (lecture + soumission persistée), **sans** notion d'avis vérifié

## Objectif

Brancher la page Avis du frontend (aujourd'hui 100 % données démo) sur un vrai backend :
lecture des avis depuis la base et soumission persistée par l'utilisateur connecté. Chaque avis
affiche son **contexte kilométrique** (km parcourus sur le pneu au moment de l'avis, km total du
cycliste), calculé depuis Strava — c'est ce contexte, et non un badge, qui éclaire la crédibilité.

## Contexte existant

- **Front déjà construit** (données démo en dur) :
  - `frontend/src/pages/AvisPage.tsx` — liste, filtre par modèle + recherche, agrégats par pneu, CTA « laisser un avis ».
  - `frontend/src/components/ReviewModal.tsx` — formulaire (note globale + 4 critères + commentaire), soumission factice (`setTimeout`).
  - `frontend/src/components/StarRating.tsx`, `CritBar.tsx` — affichage.
  - Données démo : `frontend/src/data/demo.ts` → `REVIEWS` (7 avis).
  - Fetch : `frontend/src/context/AppContext.tsx`, `fetch(path, { credentials: "include" })`, **fallback silencieux** sur démo si l'appel échoue.
- **Back** : NestJS 11 + TypeORM (better-sqlite3, `synchronize: true`). Entités `User`, `TyreModel`, `TyreSize`, `ProfileSnapshot`. Modules `auth`, `strava`, `profile`, `recommend`, `users`. **Aucun module avis.**
- **Seed** : script standalone `backend/scripts/import-tyres.ts` (better-sqlite3 direct). Pattern à suivre pour seeder les avis démo.
- `ProfileService` somme déjà les distances des activités Strava → réutilisable pour le calcul km-depuis-pose.

## Shape attendu par le front (à respecter)

Un avis tel que consommé par `AvisPage` (shape déjà présent dans `REVIEWS`, **inchangé**) :

```jsonc
{
  "id": 1,
  "name": "Élodie M.",
  "location": "Annecy, Haute-Savoie",
  "tire": "Power All Season TLR",
  "km": 2840,            // km au moment de l'avis (contexte)
  "totalKm": 8420,       // km total du cycliste (contexte)
  "rating": 5,           // note globale 1–5
  "text": "…",
  "date": "12 avril 2026",
  "criteria": { "grip": 5, "durabilite": 4, "confort": 5, "anticrv": 5 }
}
```

Pas de champ `verified` : la notion d'avis vérifié est retirée. Les agrégats par pneu (`count`, `avg`)
restent **calculés côté front** à partir de la liste (code déjà présent dans `AvisPage`).

## Architecture (back)

Nouveau module autonome `backend/src/avis/` :

```
avis/
  review.entity.ts          # entité TypeORM Review
  avis.module.ts
  avis.controller.ts        # routes /api/reviews
  avis.service.ts           # lecture, soumission (upsert), calcul du contexte km
  dto/create-review.dto.ts  # validation class-validator
```

À enregistrer dans `app.module.ts` (entité `Review` dans le tableau `entities`, `AvisModule` dans `imports`).

### Couture km (point de jointure unique)

Le calcul des km Strava vit côté Strava/Profile, **pas** dans le module avis :

- `kmRiddenSince(userId, since: Date): Promise<number>` — somme des distances des activités Strava postérieures à `since`. Réutilisée plus tard par le Tyre Score.
- `resolveMountDate(userId, tyreModelId): Promise<Date>` — **stub** : renvoie aujourd'hui − 90 jours.
  - `// TODO: remplacer par la date de pose persistée (garage) quand le Tyre Score back existera.`
  - **C'est le seul endroit à changer** lorsque le garage persistera la pose. Le module avis ne bouge pas.

Décision de séquencement (validée) : on ne bloque pas les avis sur le garage. Le calcul km-depuis-date
est fait **en vrai** dès maintenant (données Strava déjà disponibles) ; seule la *source de la date de pose*
est stubée et basculera plus tard sur le garage.

## Modèle de données — entité `Review`

| Champ | Type | Source |
|---|---|---|
| `id` | PK auto | — |
| `userId` | int **nullable**, FK User (`onDelete: CASCADE`) | session (null pour les avis démo seedés) |
| `tyreModelId` | int, FK TyreModel | choix du modèle |
| `authorName` | text | **fallback** : rempli en dur pour les seeds. Pour un vrai avis, voir résolution ci-dessous (le `User` prime). |
| `authorLocation` | text | **fallback** : rempli en dur pour les seeds. Pour un vrai avis, voir résolution ci-dessous (le `User` prime). |
| `rating` | int 1–5 | formulaire (note globale) |
| `gripScore` | int 1–5 | critère grip |
| `durabilityScore` | int 1–5 | critère durabilité |
| `comfortScore` | int 1–5 | critère confort |
| `punctureScore` | int 1–5 | critère anti-crevaison |
| `comment` | text | formulaire |
| `mountDate` | date | `resolveMountDate(...)` |
| `kmAtReview` | int | **calculé** : `kmRiddenSince(userId, mountDate)` — affiché « Avis après X km » |
| `totalKm` | int | **calculé** : km Strava total du cycliste — affiché « Y km au total » |
| `createdAt` | timestamp (`@CreateDateColumn`) | auto |

**Résolution de l'auteur (le `User` prime)** : à la lecture, le nom et le lieu affichés sont calculés ainsi :

1. **Si l'avis a un `userId` (utilisateur existant)** → on utilise **en priorité** les infos courantes du `User`
   (`firstname + " " + lastname[0] + "."` et `city + ", " + state`). Les données utilisateur font foi.
2. **Sinon (avis démo seedé, `userId = null`)** → on retombe sur les colonnes `authorName` / `authorLocation`
   stockées en dur.

Les colonnes dénormalisées servent donc de **fallback** (seeds, ou robustesse si un `User` est supprimé) ;
elles ne masquent jamais les infos d'un utilisateur réel encore présent.

**Unicité `(userId, tyreModelId)`** → upsert : re-soumettre sur le même pneu met à jour l'avis existant.
NB : SQLite traite les `NULL` comme distincts dans une contrainte unique → plusieurs avis démo (`userId = null`)
sur le même modèle restent permis (le jeu démo a 4 avis sur « Power All Season TLR »).

## Routes API

Contrôleur `@Controller('api')` (cohérent avec `recommend`).

| Route | Auth | Rôle |
|---|---|---|
| `GET /api/reviews?tire=<model>` | non (public) | Liste d'avis au shape front ci-dessus, filtrable par modèle. Tri par `createdAt` desc. |
| `POST /api/reviews` | oui (`AuthenticatedGuard`) | Soumet / upsert un avis. Calcule `mountDate`, `kmAtReview`, `totalKm`, le snapshot auteur. Renvoie l'avis créé au shape front. **Aucun seuil, aucune condition de km : l'avis est toujours créé.** |

- **Lecture publique** (alimente la page démo et la landing sans auth).
- `POST` corps validé par `CreateReviewDto` (`tyreModelId` ou nom de modèle, `rating` 1–5, 4 critères 1–5, `comment`).

## Liste des fonctionnalités

**Lecture**
- Lister les avis, filtre par modèle + recherche (UI existante → branchée sur l'API).
- Agrégats par pneu (nombre + note moyenne) — calculés côté front à partir de la liste.
- Carte d'avis : auteur, lieu, modèle, km à l'avis, km total, note globale, 4 critères, texte, date.

**Écriture**
- Soumission : note globale (requise) + 4 critères + commentaire, rattachée à un modèle de pneu.
- Auth obligatoire (utilisateur Strava connecté), sans condition de kilométrage.
- `mountDate` résolu côté back (stub aujourd'hui, garage demain) — **pas de champ date dans le modal**.
- Upsert : un avis par `(user, modèle)` ; re-soumission = mise à jour.
- Validation DTO (`rating` 1–5, critères 1–5, longueur commentaire, modèle existant).

**Contexte km (affichage, pas de gate)**
- Calcul km-depuis-pose via Strava (`kmRiddenSince`) → `kmAtReview` stocké sur l'avis.
- `totalKm` du cycliste, stocké sur l'avis.
- Affichés tels quels sur la carte (« Avis après X km », « Y km au total ») pour éclairer la crédibilité.

**Plomberie / démo**
- Entité `Review` + module enregistrés dans `app.module.ts`.
- Seed des 7 avis démo en base (`userId = null`, `authorName`/`authorLocation` en dur),
  via un script type `scripts/import-tyres.ts`, pour que la liste ne soit pas vide au jury.
- Front :
  - Remplacer la lecture de `REVIEWS` (démo) par un `fetch('/api/reviews')` (fallback silencieux sur `REVIEWS` démo si échec — convention CLAUDE.md).
  - Brancher la soumission du `ReviewModal` sur `POST /api/reviews`.
  - Retirer la copie « avis vérifiés » / « seuil requis » du CTA et du titre de page (plus de notion de vérification).

## Hors scope (YAGNI hackathon)

- **Avis vérifié / badge / seuil** — retiré du périmètre.
- Modération / signalement d'avis.
- Votes « utile » / likes.
- Photos.
- Historique d'édition.
- Pagination (jeu de données petit).
- Persistance du garage / Tyre Score back (chantier séparé ; seule `resolveMountDate` y fera le pont).

## Points tranchés en brainstorming

1. **Pas d'avis vérifié** : ni badge, ni seuil, ni gate. L'avis est toujours créé ; le contexte km affiché suffit à éclairer la crédibilité.
2. **Date de pose** : stub `aujourd'hui − 90 j` côté back (pas de champ dans le modal) ; basculera sur le garage via `resolveMountDate` uniquement.
3. **Upsert** : un avis par `(user, modèle)`, re-soumission = mise à jour.
4. **Lecture publique** des avis (sans auth).
5. **Calcul Strava réel** dès maintenant (données déjà disponibles) pour le contexte km ; seule la source de la date est stubée.
6. **Résolution auteur** : si l'avis a un `userId`, les infos du `User` priment (calculées à la lecture) ; les colonnes `authorName`/`authorLocation` ne servent que de fallback (seeds `userId = null`, ou `User` supprimé).
