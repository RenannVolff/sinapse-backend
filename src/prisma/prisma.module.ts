import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() // Importante: Torna o Prisma acessível em todo o projeto
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
