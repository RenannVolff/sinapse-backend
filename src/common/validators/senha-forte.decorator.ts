import { applyDecorators } from '@nestjs/common';
import { IsString, Matches, MinLength } from 'class-validator';

// Mínimo 8 caracteres, 1 maiúscula, 1 minúscula e (1 número ou 1 caractere
// especial). Reaproveitado em qualquer DTO que precise validar força de
// senha (cadastro, redefinição), pra não duplicar a regra.
export function SenhaForte() {
  return applyDecorators(
    IsString(),
    MinLength(8, { message: 'A senha deve ter no mínimo 8 caracteres' }),
    Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
      message:
        'A senha deve conter pelo menos 1 letra maiúscula, 1 minúscula, 1 número e 1 caractere especial',
    }),
  );
}
