import { IsDateString } from 'class-validator';

export class UpdateTyreDateDto {
  @IsDateString()
  mountedDate!: string;
}
