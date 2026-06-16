import { randomUUID } from 'node:crypto';
import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Logger,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { AuthenticatedGuard } from './authenticated.guard';
import { UsersService } from '../users/users.service';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
    private readonly usersService: UsersService,
  ) {}

  private get frontendUrl(): string {
    return this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
  }

  /** Démarre le flux OAuth : génère un `state` anti-CSRF et redirige vers Strava. */
  @Get('strava')
  login(@Req() req: Request, @Res() res: Response): void {
    const state = randomUUID();
    req.session.oauthState = state;
    res.redirect(this.authService.buildAuthorizeUrl(state));
  }

  /**
   * Callback Strava. Reçoit `?code=…&state=…` (succès) ou `?error=access_denied` (refus).
   * Échange le code, persiste l'utilisateur en DB, stocke son stravaId en session.
   */
  @Get('callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const expectedState = req.session.oauthState;
    delete req.session.oauthState;

    if (error) {
      const status = error === 'access_denied' ? 'denied' : 'error';
      return res.redirect(`${this.frontendUrl}/?auth=${status}`);
    }

    if (!code || !state || state !== expectedState) {
      this.logger.warn('Callback Strava avec state invalide ou code manquant.');
      return res.redirect(`${this.frontendUrl}/?auth=error`);
    }

    try {
      const user = await this.authService.exchangeCodeForToken(code);
      req.session.stravaId = user.stravaId;
      this.logger.log(`Athlète connecté : ${user.stravaId}`);
      return res.redirect(`${this.frontendUrl}/?auth=success`);
    } catch (err) {
      this.logger.error("Échec de l'échange du code Strava", err as Error);
      return res.redirect(`${this.frontendUrl}/?auth=error`);
    }
  }

  /** Renvoie l'athlète connecté (utile pour vérifier l'état de session côté front). */
  @Get('me')
  @UseGuards(AuthenticatedGuard)
  me(@Req() req: Request) {
    const user = req.user;
    if (!user) {
      throw new UnauthorizedException();
    }
    return {
      success: true,
      athlete: {
        id: user.stravaId,
        firstname: user.firstname,
        lastname: user.lastname,
        city: user.city,
        country: user.country,
        profile: user.profile,
      },
    };
  }

  /** Supprime le compte et toutes les données associées, puis détruit la session. */
  @Delete('account')
  @HttpCode(200)
  @UseGuards(AuthenticatedGuard)
  deleteAccount(@Req() req: Request, @Res() res: Response): void {
    const user = req.user;
    if (!user) {
      throw new UnauthorizedException();
    }

    this.usersService.delete(user.id).then(() => {
      req.session.destroy((err) => {
        if (err) {
          this.logger.error('Erreur lors de la destruction de la session après suppression du compte', err);
        }
        res.clearCookie('connect.sid');
        res.json({ success: true });
      });
    }).catch((err: unknown) => {
      this.logger.error('Erreur lors de la suppression du compte', err);
      res.status(500).json({ success: false, message: 'Erreur lors de la suppression du compte' });
    });
  }

  /** Détruit la session et efface le cookie. */
  @Get('logout')
  logout(@Req() req: Request, @Res() res: Response): void {
    req.session.destroy((err) => {
      if (err) {
        this.logger.error('Erreur lors de la destruction de la session', err);
      }
      res.clearCookie('connect.sid');
      res.json({ success: true });
    });
  }
}
