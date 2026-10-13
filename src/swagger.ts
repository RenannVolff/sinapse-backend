import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

// Mesmos nomes usados nos @ApiTags dos controllers: uma tag que exista só
// de um lado vira um grupo sem descrição (ou vazio) na documentação.
const TAGS: [nome: string, descricao: string][] = [
  ['Autenticação', 'Login, 2FA, verificação de e-mail e recuperação de senha'],
  ['Usuários', 'Cadastro e dados do profissional'],
  ['Aprendentes', 'Gestão de Aprendentes'],
  ['Atendimentos', 'Calendário e Sessões'],
  ['Atividades', 'Protocolos e Checklists'],
  ['PEI', 'Planos Educacionais Individualizados'],
  ['Modelos de PEI', 'Moldes reutilizáveis de PEI'],
  ['Tarefas', 'Lista de tarefas do terapeuta'],
  ['Relatórios', 'Inteligência de Dados e Gráficos'],
  ['Dashboard', 'Contadores e gráficos da tela inicial'],
  ['Inteligência Artificial', 'Relatório textual (IA com fallback heurístico)'],
  ['Exportação', 'Relatórios em Word (.docx)'],
  ['Auditoria', 'Registros de acesso a dados sensíveis (LGPD)'],
  ['Sistema', 'Disponibilidade da API'],
];

// Compartilhado entre o main.ts e a suíte e2e, que confere as exigências
// de segurança de cada rota no documento gerado.
export function criarDocumentoSwagger(app: INestApplication): OpenAPIObject {
  const builder = new DocumentBuilder()
    .setTitle('Sinapse Edu API')
    .setDescription(
      'API de Acompanhamento Neuropsicopedagógico Inteligente - TCC',
    )
    .setVersion('1.0')
    .addBearerAuth();

  for (const [nome, descricao] of TAGS) {
    builder.addTag(nome, descricao);
  }

  return SwaggerModule.createDocument(app, builder.build());
}
