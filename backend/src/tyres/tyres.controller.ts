import { Controller, Get, Query } from '@nestjs/common';
import { TyresService } from './tyres.service';

@Controller('api/tyres')
export class TyresController {
  constructor(private readonly tyresService: TyresService) {}

  @Get()
  listModels(@Query('bikeType') bikeType?: string) {
    return this.tyresService.listModels(bikeType);
  }
}
