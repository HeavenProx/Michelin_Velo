import type { CyclingActivity } from '../strava/strava.types';
import type { TyrePosition } from './garage-tyre.entity';

/** Pneu arrière : porte plus de charge + transmet la puissance → use ~1.9×. */
const POSITION_COEFF: Record<TyrePosition, number> = { FRONT: 1.0, REAR: 1.9 };

/** Disciplines hors-asphalte : abrasion accrue. */
const OFFROAD_SPORTS = new Set([
  'GravelRide',
  'MountainBikeRide',
  'EMountainBikeRide',
]);

/**
 * Vieillissement du caoutchouc : tolérance 24 mois sans pénalité,
 * puis dégradation linéaire jusqu'à 100 % à 72 mois (6 ans).
 */
const AGE_GRACE_MONTHS = 24;
const AGE_MAX_MONTHS = 72;

export interface TyreScore {
  kmUsed: number;
  kmMaxAdjusted: number;
  kmLeft: number;
  wearPercent: number;
  statusLabel: string;
  coeffTerrainMoyen: number;
  /** Nombre de mois depuis la pose du pneu. */
  ageMonths: number;
  /** Part de l'usure due au vieillissement du caoutchouc (0-100). */
  agePenaltyPercent: number;
}

/** Coefficient terrain d'une activité : 1.0 route, 1.4 offroad. */
export function terrainCoeff(activity: CyclingActivity): number {
  return OFFROAD_SPORTS.has(activity.sportType) ? 1.4 : 1.0;
}

export function statusLabel(wearPercent: number): string {
  if (wearPercent >= 80) return 'À remplacer';
  if (wearPercent >= 55) return 'À surveiller';
  return 'Bon état';
}

/**
 * Estime l'usure d'un pneu depuis sa pose.
 * `kmMaxAjusté = lifetimeKm / (coeffPosition × coeffTerrainMoyen)`,
 * `usureKm% = kmUsed / kmMaxAjusté`.
 * L'usure totale intègre aussi la dégradation du caoutchouc liée à l'âge :
 * `usure% = usureKm% + pénalitéÂge%` (plafonné à 100).
 * Exclut home-trainer / saisie manuelle et les activités antérieures à la pose.
 */
export function computeTyreScore(
  activities: CyclingActivity[],
  position: TyrePosition,
  lifetimeKm: number,
  mountedDate: string,
  now: Date,
): TyreScore {
  const mountedMs = new Date(mountedDate).getTime();
  const relevant = activities.filter(
    (a) =>
      !a.trainer && !a.manual && new Date(a.startDate).getTime() >= mountedMs,
  );

  const kmUsed = round1(relevant.reduce((s, a) => s + a.distanceKm, 0));
  const weightedKm = relevant.reduce(
    (s, a) => s + a.distanceKm * terrainCoeff(a),
    0,
  );
  const coeffTerrainMoyen = kmUsed > 0 ? round2(weightedKm / kmUsed) : 1.0;
  const months = elapsedMonths(mountedMs, now);
  const agePenaltyPercent = computeAgePenalty(months);

  if (lifetimeKm <= 0) {
    const wp = clamp(0, 100, agePenaltyPercent);
    return {
      kmUsed,
      kmMaxAdjusted: 0,
      kmLeft: 0,
      wearPercent: wp,
      statusLabel: statusLabel(wp),
      coeffTerrainMoyen,
      ageMonths: months,
      agePenaltyPercent,
    };
  }

  const kmMaxAdjusted = Math.round(
    lifetimeKm / (POSITION_COEFF[position] * coeffTerrainMoyen),
  );
  const kmWearPercent = Math.round((kmUsed / kmMaxAdjusted) * 100);
  const wearPercent = clamp(0, 100, kmWearPercent + agePenaltyPercent);
  const kmLeft = Math.max(0, Math.round(kmMaxAdjusted - kmUsed));

  return {
    kmUsed,
    kmMaxAdjusted,
    kmLeft,
    wearPercent,
    statusLabel: statusLabel(wearPercent),
    coeffTerrainMoyen,
    ageMonths: months,
    agePenaltyPercent,
  };
}

/** Nombre de mois entiers écoulés depuis `mountedMs`. */
function elapsedMonths(mountedMs: number, now: Date): number {
  const ms = now.getTime() - mountedMs;
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24 * 30.4375)));
}

/**
 * Pénalité due au vieillissement du caoutchouc.
 * 0-24 mois : aucune. 24-72 mois : linéaire 0→100 %. 72+ mois : 100 %.
 */
export function computeAgePenalty(months: number): number {
  if (months <= AGE_GRACE_MONTHS) return 0;
  return clamp(
    0,
    100,
    Math.round(
      ((months - AGE_GRACE_MONTHS) / (AGE_MAX_MONTHS - AGE_GRACE_MONTHS)) * 100,
    ),
  );
}

function clamp(min: number, max: number, v: number): number {
  return Math.min(max, Math.max(min, v));
}
function round1(v: number): number {
  return Math.round(v * 10) / 10;
}
function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
