import {
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Post,
    Request,
    UseGuards
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthResponse, LoginDto, LoginWithPasswordDto, OtpResponse, ResetPasswordDto, SendOtpDto, SignupDto, VerifyOtpDto } from '../types/auth';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('send-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enviar código OTP por SMS' })
  @ApiResponse({ status: 200, description: 'Código OTP enviado exitosamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  async sendOtp(@Body() sendOtpDto: SendOtpDto): Promise<OtpResponse> {
    return this.authService.sendOtp(sendOtpDto.phoneNumber, sendOtpDto.email);
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verificar código OTP' })
  @ApiResponse({ status: 200, description: 'Código OTP verificado exitosamente' })
  @ApiResponse({ status: 400, description: 'Código OTP inválido' })
  async verifyOtp(@Body() verifyOtpDto: VerifyOtpDto): Promise<OtpResponse> {
    return this.authService.verifyOtp(verifyOtpDto.phoneNumber, verifyOtpDto.otp);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión con OTP' })
  @ApiResponse({ status: 200, description: 'Login exitoso' })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas' })
  async login(@Body() loginDto: LoginDto): Promise<AuthResponse> {
    return this.authService.login(loginDto.phoneNumber, loginDto.otp);
  }

  @Post('login/password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión con número de teléfono y contraseña' })
  @ApiResponse({ status: 200, description: 'Login exitoso' })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas' })
  async loginWithPassword(@Body() loginDto: LoginWithPasswordDto): Promise<AuthResponse> {
    return this.authService.loginWithPassword(loginDto.phoneNumber, loginDto.password);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Renovar token de acceso' })
  @ApiResponse({ status: 200, description: 'Token renovado exitosamente' })
  @ApiResponse({ status: 401, description: 'Token de refresh inválido' })
  async refreshToken(@Body() body: { refreshToken: string }): Promise<AuthResponse> {
    return this.authService.refreshToken(body.refreshToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cerrar sesión' })
  @ApiResponse({ status: 200, description: 'Logout exitoso' })
  async logout(@Request() req: any): Promise<{ message: string }> {
    return this.authService.logout(req.user.id);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener perfil del usuario autenticado' })
  @ApiResponse({ status: 200, description: 'Perfil obtenido exitosamente' })
  async getProfile(@Request() req: any) {
    return this.authService.getProfile(req.user.id);
  }

  @Post('signup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Registrar nuevo usuario después de verificar OTP' })
  @ApiResponse({ status: 200, description: 'Usuario registrado exitosamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos o usuario ya existe' })
  async signup(@Body() signupDto: SignupDto): Promise<AuthResponse> {
    return this.authService.signup(signupDto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resetear contraseña verificando número de teléfono con OTP' })
  @ApiResponse({ status: 200, description: 'Contraseña actualizada exitosamente' })
  @ApiResponse({ status: 400, description: 'OTP inválido o datos incorrectos' })
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<{ message: string }> {
    return this.authService.resetPassword(dto);
  }
}
