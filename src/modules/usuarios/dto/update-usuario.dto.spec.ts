import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateUsuarioDto } from './update-usuario.dto';

const MENSAGEM_SENHA_FRACA =
  'A senha deve ter no mínimo 8 caracteres, com 1 letra maiúscula, 1 minúscula e 1 número ou símbolo';

async function errosDaSenha(payload: object) {
  const erros = await validate(plainToInstance(UpdateUsuarioDto, payload));
  const erro = erros.find((e) => e.property === 'senha');
  return erro ? Object.values(erro.constraints ?? {}) : [];
}

describe('UpdateUsuarioDto.senha', () => {
  it('rejeita senha fraca com a mensagem da regra @SenhaForte', async () => {
    expect(await errosDaSenha({ senha: 'sinapse2026' })).toContain(
      MENSAGEM_SENHA_FRACA,
    );
  });

  it('rejeita senha com menos de 8 caracteres', async () => {
    expect(await errosDaSenha({ senha: 'Sin@26' })).toContain(
      'A senha deve ter no mínimo 8 caracteres',
    );
  });

  it('aceita senha forte na edição', async () => {
    expect(await errosDaSenha({ senha: 'Sinapse@2026' })).toEqual([]);
  });

  it('aceita payload sem senha (campo opcional na edição)', async () => {
    expect(await errosDaSenha({ nome: 'Novo nome' })).toEqual([]);
  });
});
