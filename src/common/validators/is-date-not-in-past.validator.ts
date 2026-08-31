import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'isDateNotInPast', async: false })
export class IsDateNotInPastConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string') return false;

    const data = new Date(value);
    if (isNaN(data.getTime())) return false;

    const inicioDoDia = new Date();
    inicioDoDia.setHours(0, 0, 0, 0);

    const dataSemHora = new Date(data);
    dataSemHora.setHours(0, 0, 0, 0);

    return dataSemHora.getTime() >= inicioDoDia.getTime();
  }

  defaultMessage(_args: ValidationArguments): string {
    return 'Não é possível agendar um atendimento em uma data anterior a hoje.';
  }
}

export function IsDateNotInPast(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsDateNotInPastConstraint,
    });
  };
}
