import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';
import { IsPublic } from './modules/auth/decorators/is-public.decorator';

// Fora do mapa do AuditInterceptor: nada aqui é auditado.
@ApiTags('Sistema')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiBearerAuth()
  getHello(): string {
    return this.appService.getHello();
  }

  // Não consulta o banco de propósito: o Neon suspende o compute ocioso, e
  // um health check periódico que fizesse SELECT o manteria sempre acordado.
  @IsPublic()
  @Get('health')
  @ApiOperation({
    summary: 'Verifica se a API está no ar (sem consultar o banco)',
  })
  health(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
