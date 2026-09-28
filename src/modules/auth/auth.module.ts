import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { PrismaModule } from '../../prisma/prisma.module';
import { UsuariosModule } from '../usuarios/usuarios.module';

@Module({
  imports: [
    PrismaModule,
    UsuariosModule,
    // registerAsync: o segredo é lido em tempo de execução (depois do .env
    // carregado), sem valor padrão — main.ts recusa subir sem JWT_SECRET.
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: '1d' },
      }),
    }),
  ],
  controllers: [AuthController],
  // JwtAuthGuard é registrado como APP_GUARD no AppModule, logo após o
  // ThrottlerGuard, para garantir a ordem de execução dos guards globais.
  providers: [AuthService, JwtStrategy],
})
export class AuthModule {}
