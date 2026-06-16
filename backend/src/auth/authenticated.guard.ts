import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

/**
 * Autorise la route uniquement si un utilisateur Strava est présent en session.
 * À poser sur les routes protégées (ex. `GET /api/recommend`).
 */
@Injectable()
export class AuthenticatedGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    if (!req.session?.user) {
      throw new UnauthorizedException('Non authentifié auprès de Strava.');
    }
    return true;
  }
}
