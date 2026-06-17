import {
  Controller,
  Get,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthenticatedGuard } from '../auth/authenticated.guard';
import { RecommendService } from './recommend.service';

@Controller('api')
export class RecommendController {
  constructor(private readonly recommendService: RecommendService) {}

  @Get('recommend')
  @UseGuards(AuthenticatedGuard)
  async getRecommendation(
    @Req() req: Request,
    @Query('refresh') refresh?: string,
  ) {
    if (!req.user) throw new UnauthorizedException();
    return this.recommendService.getRecommendation(
      req.user,
      refresh === 'true',
    );
  }

  @Get('demo')
  getDemoRecommendation() {
    return this.recommendService.getDemoRecommendation();
  }
}
