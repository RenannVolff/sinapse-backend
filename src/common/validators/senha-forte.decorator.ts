import { applyDecorators } from '@nestjs/common';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { LIMITES } from '../validation/limits.constants';

// Mínimo 8 e máximo 50 caracteres, 1 maiúscula, 1 minúscula e (1 número ou 1 caractere
// especial). Reaproveitado em qualquer DTO que precise validar força de
// senha (cadastro, redefinição), pra não duplicar a regra.
export function SenhaForte() {
  return applyDecorators(
    IsString({ message: 'A senha deve ser um texto' }),
    MinLength(LIMITES.SENHA_MIN, {
      message: `A senha deve ter no mínimo ${LIMITES.SENHA_MIN} caracteres`,
    }),
    MaxLength(LIMITES.SENHA_MAX, {
      message: `A senha deve ter no máximo ${LIMITES.SENHA_MAX} caracteres`,
    }),
    Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
      message:
        'A senha deve ter no mínimo 8 caracteres, com 1 letra maiúscula, 1 minúscula e 1 número ou símbolo',
    }),
  );
}
