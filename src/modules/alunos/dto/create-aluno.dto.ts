// Define a estrutura exata que esperamos receber do Frontend
export class CreateAlunoDto {
  nomeCompleto: string;
  // O front enviará a data como texto (ex: "2015-05-20"), posteriomente converto para Date
  dataNascimento: string;

  responsavel: string;
  contato: string;
  // Por enquanto, será enviado o ID do profissional manualmente.
  // No futuro (com JWT), isso será pego automaticamente do token de login.
  usuarioId: string;
}
