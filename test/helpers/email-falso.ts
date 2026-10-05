// Substitui o EmailService nos testes (overrideProvider): nenhum e-mail sai,
// e os tokens que seriam enviados ficam em memória para o teste usar como
// se tivesse aberto a caixa de entrada.

export interface EmailEnviado {
  tipo: 'verificacao' | 'recuperacao-senha';
  destinatario: string;
  token: string;
}

export class EmailServiceFalso {
  readonly enviados: EmailEnviado[] = [];

  enviarEmailVerificacao(destinatario: string, token: string): Promise<void> {
    this.enviados.push({ tipo: 'verificacao', destinatario, token });
    return Promise.resolve();
  }

  enviarEmailRecuperacaoSenha(
    destinatario: string,
    token: string,
  ): Promise<void> {
    this.enviados.push({ tipo: 'recuperacao-senha', destinatario, token });
    return Promise.resolve();
  }

  ultimoToken(
    tipo: EmailEnviado['tipo'],
    destinatario: string,
  ): string | undefined {
    return this.enviados
      .filter((e) => e.tipo === tipo && e.destinatario === destinatario)
      .at(-1)?.token;
  }

  limpar(): void {
    this.enviados.length = 0;
  }
}
