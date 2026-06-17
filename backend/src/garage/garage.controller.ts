import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthenticatedGuard } from '../auth/authenticated.guard';
import { ReplaceTyreDto } from './dto/replace-tyre.dto';
import { SetTyreDto } from './dto/set-tyre.dto';
import { UpdateTyreDateDto } from './dto/update-tyre-date.dto';
import { GarageService } from './garage.service';

@Controller('api/garage')
export class GarageController {
  constructor(private readonly garage: GarageService) {}

  @Get()
  @UseGuards(AuthenticatedGuard)
  getGarage(@Req() req: Request) {
    if (!req.user) throw new UnauthorizedException();
    return this.garage.getGarage(req.user);
  }

  @Get('demo')
  getDemo() {
    return this.garage.getDemoGarage();
  }

  @Get('history')
  @UseGuards(AuthenticatedGuard)
  getHistory(@Req() req: Request) {
    if (!req.user) throw new UnauthorizedException();
    return this.garage.getHistory(req.user);
  }

  @Put('tyres')
  @UseGuards(AuthenticatedGuard)
  setTyre(@Req() req: Request, @Body() dto: SetTyreDto) {
    if (!req.user) throw new UnauthorizedException();
    return this.garage.setTyre(req.user, dto);
  }

  @Post('tyres/:id/replace')
  @UseGuards(AuthenticatedGuard)
  replaceTyre(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReplaceTyreDto,
  ) {
    if (!req.user) throw new UnauthorizedException();
    return this.garage.replaceTyre(req.user, id, dto);
  }

  @Patch('tyres/:id/date')
  @UseGuards(AuthenticatedGuard)
  updateTyreDate(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTyreDateDto,
  ) {
    if (!req.user) throw new UnauthorizedException();
    return this.garage.updateMountDate(req.user, id, dto.mountedDate);
  }

  @Post('sync')
  @UseGuards(AuthenticatedGuard)
  sync(@Req() req: Request) {
    if (!req.user) throw new UnauthorizedException();
    return this.garage.syncBikes(req.user);
  }
}
