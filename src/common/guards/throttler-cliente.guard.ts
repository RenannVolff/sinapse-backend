import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { obterIpCliente } from '../config/ip-cliente';

// ThrottlerGuard que conta requisições pelo IP real do cliente (cabeçalhos
// da Cloudflare) em vez do req.ip, que no Render é o IP da borda da CDN.
@Injectable()
export class ThrottlerClienteGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, any>): Promise<string> {
    return Promise.resolve(obterIpCliente(req) ?? '');
  }
}
