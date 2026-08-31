import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateAtendimentoDto } from './create-atendimento.dto';

describe('CreateAtendimentoDto - dataAtendimento não pode ser passado', () => {
  const base = {
    aprendenteId: '11111111-1111-1111-1111-111111111111',
    tituloSessao: 'Sessão de teste',
  };

  it('rejeita uma data de ontem', async () => {
    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);

    const dto = plainToInstance(CreateAtendimentoDto, {
      ...base,
      dataAtendimento: ontem.toISOString(),
    });

    const erros = await validate(dto);
    const erro = erros.find((e) => e.property === 'dataAtendimento');

    expect(erro).toBeDefined();
    expect(Object.values(erro!.constraints!)).toContain(
      'Não é possível agendar um atendimento em uma data anterior a hoje.',
    );
  });

  it('aceita uma data de hoje, mesmo em horário já passado', async () => {
    const hoje = new Date();
    hoje.setHours(0, 0, 1, 0);

    const dto = plainToInstance(CreateAtendimentoDto, {
      ...base,
      dataAtendimento: hoje.toISOString(),
    });

    const erros = await validate(dto);
    const erro = erros.find((e) => e.property === 'dataAtendimento');

    expect(erro).toBeUndefined();
  });

  it('aceita uma data futura', async () => {
    const amanha = new Date();
    amanha.setDate(amanha.getDate() + 1);

    const dto = plainToInstance(CreateAtendimentoDto, {
      ...base,
      dataAtendimento: amanha.toISOString(),
    });

    const erros = await validate(dto);
    const erro = erros.find((e) => e.property === 'dataAtendimento');

    expect(erro).toBeUndefined();
  });
});
