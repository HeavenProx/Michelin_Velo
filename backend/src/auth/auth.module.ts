import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthenticatedGuard } from './authenticated.guard';

@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  providers: [AuthService, AuthenticatedGuard],
  exports: [AuthService, AuthenticatedGuard, UsersModule],
})
export class AuthModule {}
