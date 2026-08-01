-- Mockup de demonstração: participante fictícia "Beatriz" com um caso clínico
-- "Thiago" + biblioteca de exemplo, para testar pastas, protocolo, hipóteses
-- e o agente sem preencher tudo na mão.
-- Idempotente (seguro rodar mais de uma vez — verifica antes de inserir).
-- Rode no SQL Editor do Supabase depois de aplicar schema.sql (ou
-- migration_v1.sql + migration_v2.sql + migration_v3.sql, num projeto existente).
--
-- Os documentos aqui não têm arquivo binário real no Storage (só o registro
-- e o resumo de conteúdo, que é o que o agente usa) — o link de download
-- mostra "arquivo sem binário". Se quiser o download funcionando, reenvie o
-- PDF de verdade pela própria Biblioteca (o nome pode ficar igual).

do $$
declare
  v_participant_id bigint;
  v_case_id bigint;
  v_cat_avaliacao bigint;
  v_cat_eoca bigint;
  v_cat_intervencao bigint;
  v_cat_leitura bigint;
begin
  -- Participante
  select id into v_participant_id from participants where nome = 'Beatriz (demo)' and workspace_id = 1 limit 1;
  if v_participant_id is null then
    insert into participants (workspace_id, nome, email, estagio_mentoria, observacoes_mentora)
    values (1, 'Beatriz (demo)', '', 'Módulo 1 — Fundamentos do raciocínio clínico', 'Participante fictícia criada para testar a plataforma.')
    returning id into v_participant_id;
  end if;

  -- Caso clínico
  select id into v_case_id from clinical_cases where nome = 'Thiago (demo)' and participant_id = v_participant_id limit 1;
  if v_case_id is null then
    insert into clinical_cases (
      workspace_id, participant_id, nome, idade, escola_serie, queixa_principal,
      diagnostico_preliminar, responsavel_nome, responsavel_contato, objetivo, observacoes
    ) values (
      1, v_participant_id, 'Thiago (demo)', 8, '3º ano — Escola Estadual (mock)',
      'Dificuldade de leitura e baixa concentração em sala de aula, relatada pela professora.',
      'Em avaliação inicial (EOCA aplicada)', 'Fernanda (mãe)', '(11) 90000-0003',
      'Realizar avaliação psicopedagógica inicial e identificar hipótese clínica consistente.',
      'Caso fictício criado para testar a plataforma.'
    ) returning id into v_case_id;
  end if;

  -- Pastas: Avaliação Inicial → EOCA · Intervenção → Leitura e Escrita
  select id into v_cat_avaliacao from categories where nome = 'Avaliação Inicial' and parent_id is null and workspace_id = 1;
  if v_cat_avaliacao is null then
    insert into categories (workspace_id, nome, parent_id) values (1, 'Avaliação Inicial', null) returning id into v_cat_avaliacao;
  end if;

  select id into v_cat_eoca from categories where nome = 'EOCA' and parent_id = v_cat_avaliacao;
  if v_cat_eoca is null then
    insert into categories (workspace_id, nome, parent_id) values (1, 'EOCA', v_cat_avaliacao) returning id into v_cat_eoca;
  end if;

  select id into v_cat_intervencao from categories where nome = 'Intervenção' and parent_id is null and workspace_id = 1;
  if v_cat_intervencao is null then
    insert into categories (workspace_id, nome, parent_id) values (1, 'Intervenção', null) returning id into v_cat_intervencao;
  end if;

  select id into v_cat_leitura from categories where nome = 'Leitura e Escrita' and parent_id = v_cat_intervencao;
  if v_cat_leitura is null then
    insert into categories (workspace_id, nome, parent_id) values (1, 'Leitura e Escrita', v_cat_intervencao) returning id into v_cat_leitura;
  end if;

  -- Documentos da biblioteca (conteúdo do protocolo EOCA que você enviou)
  if not exists (select 1 from documents where nome = 'Protocolo EOCA — Jorge Visca.pdf' and workspace_id = 1) then
    insert into documents (workspace_id, categoria_id, nome, tipo, tamanho, conteudo, disponivel_assistente, enviado_por)
    values (1, v_cat_eoca, 'Protocolo EOCA — Jorge Visca.pdf', 'pdf', 0, $doc1$
EOCA — Entrevista Operativa Centrada na Aprendizagem (Jorge Visca, Epistemologia Convergente).
Objetivo: pedir ao sujeito que mostre o que sabe fazer, o que lhe ensinaram e o que aprendeu, usando os materiais da caixa EOCA (menores de 5 anos: folhas, lápis sem ponta, canetinhas; maiores de 5: massa, jogos de encaixe, livros, tesoura, cartões). É o primeiro contato a sós com o aprendente, focado no fracasso escolar.
Observar: reação, organização, apropriação, imaginação, criatividade, regras utilizadas, se sabe os nomes dos materiais, qual prefere. A queixa é ouvida e comparada ao que a criança de fato faz.
Roteiro de observação em quatro eixos: (1) Temática — o que fala e demonstra (fluência verbal, lógica da fala, consciência do real/imaginário); (2) Dinâmica — postura corporal, tom de voz, atenção, tolerância à frustração, persistência; (3) Produto — o desenho, a escrita, os cálculos, organização com os materiais; (4) Dimensão afetiva e nível pedagógico — iniciativa, leitura e escrita adequadas à escolaridade, hipóteses sobre a causalidade (vínculo positivo/negativo, obstáculo epistemológico, etiologia emocional, falta de estímulo familiar).
Linhas de investigação sugeridas após a EOCA: Diagnóstico operatório de Piaget, Teste de Consciência Fonológica, Avaliação Pedagógica, Prova de leitura e escrita segundo a Psicogênese da Aprendizagem (Emília Ferreiro).
Encerramento: perguntas sobre o que mais gosta de fazer, da escola, do professor, disciplina favorita e a que não gosta, o que deseja ser quando crescer, e se sabe por que está na sessão — sempre em tom de investigação acolhedora, nunca de interrogatório.
$doc1$, true, 'Mariana Duarte');
  end if;

  if not exists (select 1 from documents where nome = 'Roteiro de Anamnese.docx' and workspace_id = 1) then
    insert into documents (workspace_id, categoria_id, nome, tipo, tamanho, conteudo, disponivel_assistente, enviado_por)
    values (1, v_cat_avaliacao, 'Roteiro de Anamnese.docx', 'docx', 0,
      'Roteiro de anamnese inicial: histórico gestacional e de desenvolvimento, marcos motores e de linguagem, histórico escolar (repetências, trocas de escola), queixa da família, rotina em casa, relação com irmãos, sono e alimentação, uso de telas. Base para contextualizar os achados da EOCA.',
      true, 'Mariana Duarte');
  end if;

  if not exists (select 1 from documents where nome = 'Atividades de consciência fonológica.pdf' and workspace_id = 1) then
    insert into documents (workspace_id, categoria_id, nome, tipo, tamanho, conteudo, disponivel_assistente, enviado_por)
    values (1, v_cat_leitura, 'Atividades de consciência fonológica.pdf', 'pdf', 0,
      'Atividades de consciência fonológica: rimas com apoio de imagens, segmentação silábica com palmas, identificação do som inicial, troca de fonema (mala → bala). Sempre do maior para o menor: palavra, sílaba, fonema. Material concreto antes do registro escrito.',
      true, 'Mariana Duarte');
  end if;

  -- Registro de raciocínio clínico de exemplo
  if not exists (select 1 from case_notes where case_id = v_case_id) then
    insert into case_notes (workspace_id, case_id, data_sessao, conteudo, criado_por)
    values (1, v_case_id, current_date - 2,
      'Aplicação da EOCA: Thiago explorou os materiais com iniciativa, verbalizou bem e conversou sem constrangimento. Demonstrou baixa tolerância à frustração diante de tarefas de escrita, preferindo desenho e massa de modelar. Leitura silabada, com omissão de letras. Combinado: aplicar Teste de Consciência Fonológica na próxima sessão.',
      'Beatriz (demo)');
  end if;

  -- Hipótese clínica de exemplo
  if not exists (select 1 from hypotheses where case_id = v_case_id) then
    insert into hypotheses (workspace_id, case_id, texto, status, evidencias_favor, evidencias_contra)
    values (1, v_case_id,
      'A dificuldade de leitura de Thiago está mais ligada a baixa tolerância à frustração e evitação de tarefas de escrita do que a um déficit de decodificação em si.',
      'ativa',
      'Leitura silabada mas com iniciativa e boa verbalização na EOCA; prefere tarefas sem registro escrito.',
      'Ainda não foi aplicado o Teste de Consciência Fonológica — pode revelar um componente fonológico real.');
  end if;

  -- Linha do tempo
  if not exists (select 1 from events where case_id = v_case_id and tipo = 'sessao') then
    insert into events (workspace_id, participant_id, case_id, tipo, descricao, criado_em)
    values (1, v_participant_id, v_case_id, 'sessao', 'Beatriz registrou um raciocínio clínico (EOCA).', now() - interval '2 days');
  end if;
  if not exists (select 1 from events where case_id = v_case_id and tipo = 'material') then
    insert into events (workspace_id, participant_id, case_id, tipo, descricao, criado_em)
    values (1, v_participant_id, v_case_id, 'material', 'Mentora vinculou o protocolo EOCA à biblioteca.', now() - interval '3 days');
  end if;
  if not exists (select 1 from events where case_id = v_case_id and tipo = 'hipotese') then
    insert into events (workspace_id, participant_id, case_id, tipo, descricao, criado_em)
    values (1, v_participant_id, v_case_id, 'hipotese', 'Beatriz registrou uma nova hipótese clínica.', now() - interval '1 days');
  end if;
end $$;
