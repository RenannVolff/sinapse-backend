import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const LIMITE_REGISTROS = 50;

@Injectable()
export class AuditLogsService {
  constructor(private prisma: PrismaService) {}

  async findAll(usuarioId: string) {
    const logs = await this.prisma.auditLog.findMany({
      where: { userId: usuarioId },
      orderBy: { createdAt: 'desc' },
      take: LIMITE_REGISTROS,
    });

    return logs.map((log) => ({
      id: log.id,
      criadoEm: log.createdAt,
      acao: log.action,
      recurso: log.resource,
      resumo:
        [
          log.resourceId ? `ID ${log.resourceId}` : null,
          log.ipAddress ? `IP ${log.ipAddress}` : null,
        ]
          .filter(Boolean)
          .join(' · ') || '—',
    }));
  }
}
