import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService],
  // Exporté : StravaModule (à venir) s'en servira pour obtenir un access token valide.
  exports: [AuthService],
})
export class AuthModule {}
