import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class QueryBillDto {
  @ApiProperty({ description: 'ID del proveedor de servicio', example: 'TELMEX' })
  @IsNotEmpty()
  @IsString()
  providerId: string;

  @ApiProperty({ description: 'Número de cuenta o referencia del servicio', example: '1234567890' })
  @IsNotEmpty()
  @IsString()
  accountNumber: string;
}

export class PayServiceDto {
  @ApiProperty({ description: 'ID del proveedor de servicio', example: 'TELMEX' })
  @IsNotEmpty()
  @IsString()
  providerId: string;

  @ApiProperty({ description: 'Número de cuenta o referencia del servicio', example: '1234567890' })
  @IsNotEmpty()
  @IsString()
  accountNumber: string;

  @ApiProperty({ description: 'Monto a pagar', example: 500.0, minimum: 0.01 })
  @IsNotEmpty()
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ description: 'Referencia adicional (opcional)', required: false })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiProperty({ description: 'PIN de seguridad del usuario', example: '1234' })
  @IsNotEmpty()
  @IsString()
  pin: string;
}

