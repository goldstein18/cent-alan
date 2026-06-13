import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({
      usernameField: 'phoneNumber',
      passwordField: 'otp',
    });
  }

  async validate(phoneNumber: string, otp: string): Promise<any> {
    const user = await this.authService.validateUser(phoneNumber, otp);
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    return user;
  }
}
