import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SenhaForte } from './senha-forte.decorator';

class SenhaDto {
  @SenhaForte()
  senha!: string;
}

async function validarSenha(senha: unknown) {
  const erros = await validate(plainToInstance(SenhaDto, { senha }));
  return erros.flatMap((e) => Object.values(e.constraints ?? {}));
}

describe('@SenhaForte', () => {
  it('aceita senha forte com maiúscula, minúscula, número e símbolo', async () => {
    expect(await validarSenha('Sinapse@2026')).toEqual([]);
  });

  it('aceita senha com maiúscula, minúscula e apenas número (sem símbolo)', async () => {
    expect(await validarSenha('Sinapse2026')).toEqual([]);
  });

  it('aceita senha com maiúscula, minúscula e apenas símbolo (sem número)', async () => {
    expect(await validarSenha('Sinapse@Edu')).toEqual([]);
  });

  it('rejeita senha sem letra maiúscula', async () => {
    const erros = await validarSenha('sinapse@2026');

    expect(erros).toContainEqual(
      expect.stringContaining('1 número ou símbolo'),
    );
  });

  it('rejeita senha sem letra minúscula', async () => {
    const erros = await validarSenha('SINAPSE@2026');

    expect(erros).toContainEqual(
      expect.stringContaining('1 número ou símbolo'),
    );
  });

  it('rejeita senha sem número e sem símbolo', async () => {
    const erros = await validarSenha('SinapseEdu');

    expect(erros).toContainEqual(
      expect.stringContaining('1 número ou símbolo'),
    );
  });

  it('rejeita senha com menos de 8 caracteres', async () => {
    const erros = await validarSenha('Sin@26');

    expect(erros).toContain('A senha deve ter no mínimo 8 caracteres');
  });

  it('aceita senha com exatamente 8 caracteres', async () => {
    expect(await validarSenha('Sinaps@1')).toEqual([]);
  });

  it('rejeita valor que não é texto', async () => {
    expect((await validarSenha(12345678)).length).toBeGreaterThan(0);
  });
});
