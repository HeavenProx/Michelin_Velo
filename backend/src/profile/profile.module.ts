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
