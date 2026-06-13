import { IsIn, IsOptional, IsString } from 'class-validator';

export class RegisterTokenDto {
  @IsString()
  token: string;

  @IsOptional()
  @IsIn(['ios', 'android'])
  platform?: string;

  /** Ignored if sent; server always stores demo-finance-app */
  @IsOptional()
  @IsString()
  appSlug?: string;
}
