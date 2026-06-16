import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { StravaAthlete } from '../auth/auth.types';
import { User } from './user.entity';

export interface TokenData {
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: number;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
  ) {}

  findByStravaId(stravaId: number): Promise<User | null> {
    return this.repo.findOneBy({ stravaId });
  }

  async findOrCreate(athlete: StravaAthlete, tokens: TokenData): Promise<User> {
    let user = await this.findByStravaId(athlete.id);

    if (user) {
      user.firstname = athlete.firstname;
      user.lastname = athlete.lastname;
      user.city = athlete.city ?? null;
      user.state = athlete.state ?? null;
      user.country = athlete.country ?? null;
      user.sex = athlete.sex ?? null;
      user.profile = athlete.profile;
      user.accessToken = tokens.accessToken;
      user.refreshToken = tokens.refreshToken;
      user.tokenExpiresAt = tokens.tokenExpiresAt;
    } else {
      user = this.repo.create({
        stravaId: athlete.id,
        firstname: athlete.firstname,
        lastname: athlete.lastname,
        city: athlete.city ?? null,
        state: athlete.state ?? null,
        country: athlete.country ?? null,
        sex: athlete.sex ?? null,
        profile: athlete.profile,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiresAt: tokens.tokenExpiresAt,
      });
    }

    return this.repo.save(user);
  }

  async updateTokens(user: User, tokens: TokenData): Promise<User> {
    user.accessToken = tokens.accessToken;
    user.refreshToken = tokens.refreshToken;
    user.tokenExpiresAt = tokens.tokenExpiresAt;
    return this.repo.save(user);
  }
}
