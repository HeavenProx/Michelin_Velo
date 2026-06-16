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
