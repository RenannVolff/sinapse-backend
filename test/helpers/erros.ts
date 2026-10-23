// Leitura do formato de erro do contrato com o front:
// { statusCode, code, message, errors?: [{ field, message }] }

export interface ErroCampo {
  field: string;
  message: string;
}

export interface CorpoErro {
  statusCode: number;
  code: string;
  message: string;
  errors?: ErroCampo[];
}

export function errosDe(body: unknown): ErroCampo[] {
  return (body as CorpoErro).errors ?? [];
}

export function mensagensDe(body: unknown): string[] {
  return errosDe(body).map((e) => e.message);
}

export function camposDe(body: unknown): string[] {
  return errosDe(body).map((e) => e.field);
}

// 400 de validação: o corpo tem exatamente as chaves do contrato.
export function esperarErroValidacao(body: unknown): void {
  expect(body).toEqual({
    statusCode: 400,
    code: 'VALIDATION_ERROR',
    message: 'Revise os campos destacados.',
    errors: expect.any(Array) as ErroCampo[],
  });
  expect(errosDe(body).length).toBeGreaterThan(0);
}
