import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { UsersService } from '../users/users.service';

/**
 * Autorise la route uniquement si un stravaId est présent en session et correspond
 * à un utilisateur en base. Attache l'entité User sur `req.user`.
 */
@Injectable()
export class AuthenticatedGuard implements CanActivate {
  constructor(private readonly users: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const stravaId = req.session?.stravaId;

    if (!stravaId) {
      throw new UnauthorizedException('Non authentifié auprès de Strava.');
    }

    const user = await this.users.findByStravaId(stravaId);
    if (!user) {
      throw new UnauthorizedException('Utilisateur introuvable en base.');
    }

    req.user = user;
    return true;
  }
}
