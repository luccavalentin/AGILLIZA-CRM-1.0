
-- Alinha as políticas de visualização e edição para honrarem TODOS os escopos
-- (todos, equipe, próprios e personalizado) usando as funções de acesso
-- centralizadas, que já implementam a regra completa.

-- CLIENTES
DROP POLICY IF EXISTS "Ver clientes conforme escopo" ON public.clientes;
CREATE POLICY "Ver clientes conforme escopo"
ON public.clientes FOR SELECT TO authenticated
USING (public.usuario_tem_acesso_cliente(auth.uid(), id));

-- SIMULAÇÕES
DROP POLICY IF EXISTS "Ver simulacoes por escopo" ON public.simulacoes;
CREATE POLICY "Ver simulacoes por escopo"
ON public.simulacoes FOR SELECT TO authenticated
USING (public.usuario_tem_acesso_simulacao(auth.uid(), id));

-- PROPOSTAS
DROP POLICY IF EXISTS "propostas_select" ON public.propostas;
CREATE POLICY "propostas_select"
ON public.propostas FOR SELECT TO authenticated
USING (public.usuario_tem_acesso_proposta(auth.uid(), id));

DROP POLICY IF EXISTS "propostas_update" ON public.propostas;
CREATE POLICY "propostas_update"
ON public.propostas FOR UPDATE TO authenticated
USING (public.usuario_tem_acesso_proposta(auth.uid(), id))
WITH CHECK (correspondente_id = public.correspondente_do_usuario(auth.uid()));

-- TAREFAS
DROP POLICY IF EXISTS "tasks leitura" ON public.tasks;
CREATE POLICY "tasks leitura"
ON public.tasks FOR SELECT TO authenticated
USING (public.usuario_tem_acesso_tarefa(auth.uid(), id));

DROP POLICY IF EXISTS "tasks update" ON public.tasks;
CREATE POLICY "tasks update"
ON public.tasks FOR UPDATE TO authenticated
USING (public.usuario_tem_acesso_tarefa(auth.uid(), id))
WITH CHECK (correspondente_id = public.correspondente_do_usuario(auth.uid()));

-- DEMANDAS
DROP POLICY IF EXISTS "demandas leitura" ON public.demandas;
CREATE POLICY "demandas leitura"
ON public.demandas FOR SELECT TO authenticated
USING (public.usuario_tem_acesso_demanda(auth.uid(), id));

DROP POLICY IF EXISTS "demandas update" ON public.demandas;
CREATE POLICY "demandas update"
ON public.demandas FOR UPDATE TO authenticated
USING (public.usuario_tem_acesso_demanda(auth.uid(), id))
WITH CHECK (correspondente_id = public.correspondente_do_usuario(auth.uid()));
