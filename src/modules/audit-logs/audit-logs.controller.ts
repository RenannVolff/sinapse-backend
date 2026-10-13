import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuditLogsService } from './audit-logs.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';

@ApiBearerAuth()
@ApiTags('Auditoria')
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get()
  @ApiOperation({
    summary:
      'Lista os últimos 50 registros de auditoria do usuário autenticado',
  })
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.auditLogsService.findAll(user.id);
  }
}
