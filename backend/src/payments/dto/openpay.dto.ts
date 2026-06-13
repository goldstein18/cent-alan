import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class OpenPayCreateCashReferenceDto {
  @ApiProperty({ description: 'Número de teléfono del usuario que recibirá el abono (formato libre MX)', example: '5512345678' })
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @ApiProperty({ description: 'Monto a abonar', example: 250.5, minimum: 1 })
  @IsNumber()
  @Min(1)
  amount: number;
}

export class OpenPayDepositStatusDto {
  @ApiProperty({ description: 'Referencia interna generada por CENT (OPY-...)', example: 'OPY-1744213000-ABC123' })
  @IsString()
  @IsNotEmpty()
  reference: string;
}
