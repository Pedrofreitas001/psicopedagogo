-- Mockup de demonstração: participante fictícia "Beatriz" com um caso clínico
-- "Thiago" + biblioteca de exemplo, para testar pastas, protocolo, hipóteses
-- e o agente sem preencher tudo na mão. Traz também "Fernanda" com o caso
-- "Vitor" — um cenário mais desenvolvido (várias sessões, protocolo aplicado,
-- três hipóteses em estágios diferentes) para testar a interatividade do
-- agente e o card de "próximo passo" num caso com mais história.
-- Idempotente (seguro rodar mais de uma vez — verifica antes de inserir).
-- O bloco do protocolo do caso "Vitor" só roda se o protocolo builtin já
-- tiver sido sincronizado — abra a tela de Protocolos no app pelo menos uma
-- vez (ou rode este script de novo depois) para ele aparecer preenchido.
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
  v_participant2_id bigint;
  v_case2_id bigint;
  v_protocol_id bigint;
  v_assignment_id bigint;
  v_conv_id bigint;
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

  -- ---------------------------------------------------------------------
  -- Segundo caso de demonstração — cenário mais desenvolvido: várias sessões
  -- ao longo de semanas, protocolo estruturado aplicado, três hipóteses em
  -- estágios diferentes (uma pronta para decisão, uma confirmada, uma
  -- descartada) e uma conversa já registrada. Bom para testar a
  -- interatividade do agente num caso com mais história.
  -- ---------------------------------------------------------------------

  -- Participante
  select id into v_participant2_id from participants where nome = 'Fernanda Alencar (demo)' and workspace_id = 1 limit 1;
  if v_participant2_id is null then
    insert into participants (workspace_id, nome, email, estagio_mentoria, observacoes_mentora)
    values (1, 'Fernanda Alencar (demo)', '', 'Módulo 3 — Construção e teste de hipóteses',
      'Já concluiu dois casos anteriores. Muito boa reunindo evidências; ainda hesita em fechar a decisão clínica no tempo certo.')
    returning id into v_participant2_id;
  end if;

  -- Caso clínico
  select id into v_case2_id from clinical_cases where nome = 'Vitor (demo)' and participant_id = v_participant2_id limit 1;
  if v_case2_id is null then
    insert into clinical_cases (
      workspace_id, participant_id, nome, idade, escola_serie, queixa_principal,
      diagnostico_preliminar, responsavel_nome, responsavel_contato, objetivo, observacoes
    ) values (
      1, v_participant2_id, 'Vitor (demo)', 10, '5º ano — Escola Estadual Monteiro Lobato',
      'Compreensão leitora abaixo do esperado para a série; erra questões inferenciais mesmo lendo o texto corretamente em voz alta.',
      'Nenhum laudo até o momento — encaminhado pela coordenação pedagógica da escola.',
      'Marcos (pai)', '(11) 90000-0099',
      'Identificar se a dificuldade é de decodificação, de processamento cognitivo (memória/inferência) ou de repertório de vocabulário, para orientar o plano de intervenção.',
      'Se engaja bem em tarefas orais e temas de ciência/games; evita ler em voz alta e demonstra desconforto quando é corrigido na frente da turma.'
    ) returning id into v_case2_id;
  end if;

  -- Registros de raciocínio clínico (quatro sessões ao longo de ~3 semanas)
  if not exists (select 1 from case_notes where case_id = v_case2_id) then
    insert into case_notes (workspace_id, case_id, data_sessao, conteudo, criado_por, criado_em) values
    (1, v_case2_id, current_date - 24,
      'Primeiro contato e aplicação da EOCA: Vitor mostrou boa fluência verbal e organização ao explorar os materiais, mas evitou ativamente tarefas de leitura e escrita, preferindo desenhar. Relatou não gostar de ler "porque é chato", sem verbalizar dificuldade específica.',
      'Fernanda Alencar (demo)', now() - interval '24 days'),
    (1, v_case2_id, current_date - 17,
      'Teste de consciência fonológica: desempenho dentro do esperado para a idade — segmentação e manipulação de fonemas preservadas, sem indícios de dificuldade fonológica de base.',
      'Fernanda Alencar (demo)', now() - interval '17 days'),
    (1, v_case2_id, current_date - 10,
      'Avaliação de compreensão leitora com perguntas literais e inferenciais: 90% de acerto em questões literais, 40% em inferenciais. Fluência de leitura em voz alta adequada, sem trocas ou omissões relevantes.',
      'Fernanda Alencar (demo)', now() - interval '10 days'),
    (1, v_case2_id, current_date - 3,
      'Conversa com a professora regente: relata que Vitor participa bem oralmente das discussões de texto em sala, mas trava quando precisa responder por escrito. Levanta a possibilidade de a dificuldade envolver também produção escrita, não só compreensão.',
      'Fernanda Alencar (demo)', now() - interval '3 days');
  end if;

  -- Hipóteses em três estágios diferentes
  if not exists (select 1 from hypotheses where case_id = v_case2_id) then
    insert into hypotheses (workspace_id, case_id, texto, status, evidencias_favor, evidencias_contra, criado_em, atualizado_em) values
    (1, v_case2_id,
      'A dificuldade de Vitor é predominantemente de processamento inferencial — não de decodificação nem de consciência fonológica.',
      'ativa',
      'Fluência de leitura e consciência fonológica dentro do esperado; 90% de acerto em questões literais; boa participação oral em discussões de texto.',
      'Ainda não foi testado se o desempenho oral se mantém quando a resposta precisa ser escrita — a professora sugere que parte do erro pode ser de produção escrita, não de compreensão em si.',
      now() - interval '9 days', now() - interval '2 days'),
    (1, v_case2_id,
      'A resistência à leitura em voz alta tem componente emocional (medo de errar na frente da turma), não só cognitivo.',
      'confirmada',
      'Evita ativamente tarefas de leitura mesmo com fluência adequada; verbalizou desconforto com correções públicas; comportamento consistente em mais de uma sessão.',
      '', now() - interval '23 days', now() - interval '16 days'),
    (1, v_case2_id,
      'A dificuldade de compreensão decorre de um déficit de consciência fonológica de base.',
      'descartada',
      '', 'Teste de consciência fonológica dentro do esperado para a idade — hipótese não sustentada pelos dados.',
      now() - interval '24 days', now() - interval '17 days');
  end if;

  -- Protocolo estruturado aplicado (só se já tiver sido sincronizado — abre a
  -- tela de Protocolos pelo menos uma vez antes de rodar este script de novo
  -- se quiser garantir que a aplicação apareça)
  select id into v_protocol_id from protocols where nome = 'Avaliação da Compreensão Leitora — Textos Expositivos' and workspace_id = 1 limit 1;
  if v_protocol_id is not null and not exists (select 1 from protocol_assignments where case_id = v_case2_id) then
    insert into protocol_assignments (workspace_id, case_id, protocol_id, data_aplicacao, status, criado_por, criado_em, atualizado_em)
    values (1, v_case2_id, v_protocol_id, current_date - 10, 'concluido', 'Fernanda Alencar (demo)', now() - interval '10 days', now() - interval '10 days')
    returning id into v_assignment_id;

    -- IMPORTANTE: o app grava as respostas do protocolo com uma camada extra
    -- de codificação JSON (lib/data.ts, saveResponses/getResponses) — grava
    -- como texto duas vezes serializado, não como jsonb "limpo". Por isso o
    -- to_jsonb(...::text) abaixo, e não um simples ::jsonb.
    insert into protocol_responses (assignment_id, field_id, valor)
    select v_assignment_id, pf.id, to_jsonb((valor::jsonb)::text)
    from (values
      ('nome', '"Vitor"'),
      ('idade', '10'),
      ('escolaridade', '"5º ano do Ensino Fundamental"'),
      ('data_avaliacao', '"' || to_char(current_date - 10, 'DD/MM/YYYY') || '"'),
      ('texto_utilizado', '"Como os vulcões se formam (texto expositivo, divulgação científica)"'),
      ('genero_finalidade', '"Divulgação científica"'),
      ('vocabulario_geral', '"Adequado"'),
      ('necessidade_investigacao', '"Sim"'),
      ('investigacao_qual', '"Avaliação da produção escrita, para diferenciar de compreensão leitora."'),
      ('hipotese_clinica', '"Dificuldade inferencial"'),
      ('aspectos_cognitivos', '["Inferência"]'),
      ('observacoes_clinicas', '"Boa compreensão literal e fluência de leitura; erro concentrado em questões inferenciais (nível 2). Investigar se o padrão se repete na escrita antes de fechar a hipótese."')
    ) as respostas(chave, valor)
    join protocol_fields pf on pf.chave = respostas.chave
    join protocol_sections ps on ps.id = pf.section_id and ps.protocol_id = v_protocol_id;
  end if;

  -- Conversa já registrada com o mentor (mostra o formato pergunta/resposta)
  if not exists (select 1 from conversations where case_id = v_case2_id) then
    insert into conversations (workspace_id, participant_id, case_id, titulo, criado_em)
    values (1, v_participant2_id, v_case2_id, 'A professora falou que ele trava só na escrita — muda a hipótese?', now() - interval '2 days')
    returning id into v_conv_id;

    insert into messages (conversation_id, papel, autor, conteudo, fontes, criado_em) values
    (v_conv_id, 'usuario', 'Fernanda Alencar (demo)',
      'A professora falou que o Vitor participa bem oralmente mas trava pra responder por escrito. Isso muda minha hipótese?',
      '[]', now() - interval '2 days'),
    (v_conv_id, 'assistente', 'Mentor Clínico',
      'Antes de mudarmos a hipótese, vale isolar uma coisa: quando você diz que ele "trava" por escrito, é a formulação da resposta que falha, ou a compreensão do texto que já não aparece nem oralmente quando a pergunta é sobre o mesmo trecho?' || chr(10) || chr(10) ||
      'Pergunto isso porque, se a compreensão oral se mantém e só a resposta escrita falha, isso aponta mais para produção escrita do que para compreensão leitora — e mudaria o que você está de fato testando na hipótese 1.',
      '[{"tipo":"hipotese","titulo":"Hipótese (ativa)"},{"tipo":"prontuario","titulo":"Registro de raciocínio — Vitor"}]',
      now() - interval '2 days');
  end if;

  -- Linha do tempo
  if not exists (select 1 from events where case_id = v_case2_id) then
    insert into events (workspace_id, participant_id, case_id, tipo, descricao, criado_em) values
    (1, v_participant2_id, v_case2_id, 'sessao', 'Fernanda aplicou a EOCA com Vitor.', now() - interval '24 days'),
    (1, v_participant2_id, v_case2_id, 'hipotese', 'Fernanda registrou uma nova hipótese clínica.', now() - interval '23 days'),
    (1, v_participant2_id, v_case2_id, 'sessao', 'Registro de raciocínio clínico adicionado ao caso.', now() - interval '17 days'),
    (1, v_participant2_id, v_case2_id, 'sessao', 'Registro de raciocínio clínico adicionado ao caso.', now() - interval '10 days'),
    (1, v_participant2_id, v_case2_id, 'protocolo', 'Protocolo "Avaliação da Compreensão Leitora — Textos Expositivos" aplicado.', now() - interval '10 days'),
    (1, v_participant2_id, v_case2_id, 'hipotese', 'Fernanda registrou uma nova hipótese clínica.', now() - interval '9 days'),
    (1, v_participant2_id, v_case2_id, 'sessao', 'Registro de raciocínio clínico adicionado ao caso.', now() - interval '3 days'),
    (1, v_participant2_id, v_case2_id, 'conversa', 'Fernanda adicionou uma conversa com o mentor à linha do tempo.', now() - interval '2 days');
  end if;
end $$;
