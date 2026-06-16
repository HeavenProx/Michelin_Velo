# Design — Profiler cycliste (backend)

**Date :** 2026-06-16
**Statut :** validé, prêt pour plan d'implémentation
**Périmètre :** backend NestJS uniquement (`backend/src/profile/`)

## Objectif

Construire le **profiler** : à partir des activités vélo Strava d'un athlète connecté,
produire l'objet `profile` du contrat d'API (voir CLAUDE.md), consommé ensuite par le
moteur de recommandation. Le profiler est la feature cœur n°1 (« Profil cycliste
auto-généré »).

## Sortie produite (`RiderProfile`)

Conforme au contrat attendu par le front (`frontend/src/app/App.tsx`) :

```jsonc
{
  "ride_count": 0,
  "total_distance_km": 0,
  "monthly_distance": 0,
  "avg_speed_kmh": 0,
  "avg_elevation_m": 0,
  "terrain_label": "",
  "style_label": "",
  "weather_exposure": { "rain_percentage": 0, "rainy_rides": 0 },
  "region": ""
}
```

## Entrée

`StravaService.getCyclingActivities(user)` (déjà implémenté) → `CyclingActivity[]`.
Champs exploités : `distanceKm`, `movingTimeS`, `totalElevationGainM`, `averageSpeedKmh`,
`sportType`, `startDate` / `startDateLocal`, `startLatlng`.

## Architecture

Découpage par responsabilité, pour isoler l'I/O réseau (coûteux) du calcul métier
(déterministe, donc trivialement testable).

```
src/profile/
  profile.module.ts
  profile.service.ts          # orchestration + cache snapshot
  profile.stats.ts            # FONCTIONS PURES : agrégats, terrain, style, région
  profile.stats.spec.ts       # tests unitaires purs (cœur de la confiance)
  profile.types.ts            # type RiderProfile (= shape du contrat)
  profile-snapshot.entity.ts  # cache DB : userId, profile (JSON), computedAt
  weather/
    weather.service.ts        # Open-Meteo archive (historique pluie)
    weather.service.spec.ts
```

Unités et frontières :

- **`profile.stats.ts`** — fonctions pures `CyclingActivity[] → valeurs`. Aucune dépendance,
  aucun I/O. Dépend de : rien. Testée en isolation totale.
- **`WeatherService`** — isole l'I/O Open-Meteo. Expose
  `getRainExposure(activities) → { rain_percentage, rainy_rides }`. Dépend de : `fetch`.
  Mockable.
- **`ProfileService`** — orchestre : cache → Strava → stats → météo → assemblage →
  persistance. Dépend de : `StravaService`, `WeatherService`, repo `ProfileSnapshot`.

### Modules NestJS

`ProfileModule` importe `StravaModule` (pour `StravaService`) et
`TypeOrmModule.forFeature([ProfileSnapshot])`. Fournit et exporte `ProfileService`
(consommé plus tard par le futur `RecommendModule`).

## Flux de données

```
Guard (AuthenticatedGuard) → User chargé depuis la DB
  → ProfileService.getProfile(user, { refresh })
       snapshot frais (computedAt < TTL) et pas de refresh ?
         oui → renvoyer le profile JSON stocké
         non → StravaService.getCyclingActivities(user)
               → profile.stats : agrégats + terrain + style + région  (instantané)
               → WeatherService.getRainExposure(échantillon récent)   (réseau)
               → assembler RiderProfile
               → upsert ProfileSnapshot (profile JSON + computedAt)
               → renvoyer
```

## Cache snapshot

- Entité `ProfileSnapshot` : relation 1-1 avec `User` (`@OneToOne` + `@JoinColumn`, FK
  `userId` → `User.id`), colonne `profile` en `text` (JSON sérialisé), `computedAt`
  (timestamp), `updatedAt`.
- **TTL = 12 h.** Recalcul si `now - computedAt > TTL`.
- Override `?refresh=true` sur la route pour forcer le recalcul (utile démo/soutenance).
- `synchronize: true` (déjà actif) crée la table automatiquement, comme pour `User`.

## Règles de calcul

### Agrégats (`profile.stats.ts`, purs)

| Champ | Calcul |
|---|---|
| `ride_count` | nombre d'activités |
| `total_distance_km` | `Σ distanceKm`, arrondi 1 décimale |
| `avg_speed_kmh` | `Σ distanceKm / (Σ movingTimeS / 3600)`, arrondi 1 déc. — vraie moyenne pondérée par la distance (pas une moyenne de moyennes). Garde-fou si `Σ movingTimeS == 0` → 0 |
| `avg_elevation_m` | `Σ totalElevationGainM / ride_count`, arrondi entier — **dénivelé moyen par sortie** (interprétation validée) |
| `monthly_distance` | `total_distance_km / mois_couverts`, où `mois_couverts = max(1, ceil(jours(1er ride → aujourd'hui) / 30))`, arrondi entier |

### `terrain_label` — densité de grimpe = `dénivelé total / distance totale` (m/km)

- `< 8` → **Plat**
- `8–18` → **Mixte**
- `> 18` → **Montagne**

### `style_label` — échelle de priorité (premier match)

1. Type de sport dominant `MountainBikeRide` → **VTT** ; `GravelRide` → **Gravel**
2. Sinon (route), selon vitesse + distance moyenne par sortie :
   - `avg_speed_kmh ≥ 28` → **Performance**
   - `dist_moy_par_sortie ≥ 60 km` → **Endurance**
   - sinon → **Loisir / polyvalent**

### `region`

- Principal : champs athlète déjà en base → `"city, country"` (ou `state` si `city` nul).
- Si tout est nul → `""` (le front gère). Reverse-geocoding des coordonnées laissé en
  option future (YAGNI — évite une dépendance supplémentaire).

### `weather_exposure` (`WeatherService`, Open-Meteo Archive)

- **Échantillon** : les ~60 rides les plus récents ayant `startLatlng != null`.
- **Appel par ride** : endpoint *archive* d'Open-Meteo
  (`https://archive-api.open-meteo.com/v1/archive`), paramètres `latitude`, `longitude`,
  `start_date` = `end_date` = date du ride (`startDateLocal`), `daily=precipitation_sum`,
  `timezone=auto`.
  **À CONFIRMER** : noms/format exacts des paramètres et de la réponse contre la doc
  Open-Meteo via le MCP context7 au moment de l'implémentation (ne pas coder de mémoire).
- **Pluvieux** si `precipitation_sum > 1 mm` ce jour-là.
- **Cache** en mémoire (par run) clé `lat.toFixed(2),lng.toFixed(2),date` (≈ 1 km), dédoublonne
  les départs proches.
- **Concurrence** limitée à ~6 appels en parallèle (pool).
- `rainy_rides` = nb de pluvieux **dans l'échantillon exploitable** ;
  `rain_percentage = round(rainy_rides / échantillon_exploitable × 100)`.
- ⚠️ L'archive Open-Meteo a ~5 jours de latence : les rides des derniers jours peuvent ne
  pas avoir de donnée → **exclus du dénominateur** (jamais comptés comme secs à tort).

## Gestion des erreurs

- **0 activité** → `success: true`, agrégats à 0, labels neutres (« Données insuffisantes »).
- **Open-Meteo en échec/partiel** → dégradation gracieuse : profil renvoyé avec
  `weather_exposure` calculé sur ce qui a réussi (ou `{ 0, 0 }`). Ne JAMAIS faire échouer
  toute la requête à cause de la météo. Warning loggé.
- **Strava 429 / erreur** → déjà propagé proprement par `StravaService` (HttpException).

## Tests

- **`profile.stats.spec.ts`** — fixtures `CyclingActivity[]` à la main → chaque agrégat et
  label sur cas limites : liste vide, sortie plate, sortie montagne, ride unique, temps
  mobile nul, types VTT/Gravel. Cœur de la confiance, aucun mock.
- **`weather.service.spec.ts`** — `fetch` mocké → classification pluie (seuil 1 mm),
  cache (dédoublonnage), concurrence, gestion de donnée manquante (latence archive).
- **`profile.service.spec.ts`** — `StravaService`, `WeatherService` et repo mockés →
  logique de cache hit / miss / TTL expiré / `refresh=true`.

## Hors périmètre (volontairement exclu)

- Le moteur de recommandation (`/api/recommend`, règles métier pneus) — feature suivante,
  consommera `ProfileService.getProfile()`.
- Le branchement des routes `/api/recommend` et `/api/demo` — assemblées dans le module
  recommander.
- Reverse-geocoding des coordonnées GPS pour `region`.

## Points ouverts confirmés

- Seuils terrain (8 / 18 m/km), style (28 km/h, 60 km), pluie (1 mm) : **validés**.
- `avg_elevation_m` = dénivelé moyen par sortie : **validé**.
- Scope météo = échantillon des ~60 rides récents : **validé**.
- Cache = snapshot DB avec TTL 12 h : **validé**.
