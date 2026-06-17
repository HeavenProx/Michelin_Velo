import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProfileService } from '../profile/profile.service';
import { StravaService } from '../strava/strava.service';
import { TyreModel } from '../tyres/tyre-model.entity';
import type { User } from '../users/user.entity';
import { Bike } from './bike.entity';
import { GarageTyre } from './garage-tyre.entity';

@Injectable()
export class GarageService {
  constructor(
    @InjectRepository(Bike)
    private readonly bikeRepo: Repository<Bike>,
    @InjectRepository(GarageTyre)
    private readonly tyreRepo: Repository<GarageTyre>,
    @InjectRepository(TyreModel)
    private readonly modelRepo: Repository<TyreModel>,
    private readonly strava: StravaService,
    private readonly profile: ProfileService,
  ) {}

  /** Importe / met à jour les vélos Strava de l'utilisateur. */
  async syncBikes(user: User): Promise<Bike[]> {
    const stravaBikes = await this.strava.getAthleteBikes(user);
    const existing = await this.bikeRepo.find({ where: { userId: user.id } });
    const byGearId = new Map(existing.map((b) => [b.stravaGearId, b]));
    const now = Date.now();

    const result: Bike[] = [];
    for (const sb of stravaBikes) {
      const bike =
        byGearId.get(sb.gearId) ??
        this.bikeRepo.create({ userId: user.id, stravaGearId: sb.gearId });
      bike.name = sb.name;
      bike.stravaDistanceKm = sb.distanceKm;
      bike.lastSyncedAt = now;
      result.push(await this.bikeRepo.save(bike));
    }
    return result;
  }
}
