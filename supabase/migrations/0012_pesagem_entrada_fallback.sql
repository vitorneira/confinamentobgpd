-- Bug: um animal cadastrado só pela aba Cadastro_Animais (sem pesagem
-- posterior) não tem nenhuma linha em `pesagens` — a entrada só existe em
-- `animais.data_entrada`/`peso_entrada_kg`. A view tratava "sem pesagem" como
-- `data_ultima_pesagem is null` e caía direto no `else 'ok'`, então esses
-- animais nunca acendiam alerta de pesagem vencida, por mais tempo que
-- passasse. Fix: a pesagem de entrada CONTA como última pesagem quando não
-- há nenhuma pesagem real depois dela — `coalesce(data_ultima_pesagem,
-- data_entrada)` em vez de checar `is not null`. Afeta também o rollup por
-- curral (`v_curral_indicadores`) e os alertas do dashboard, que consomem
-- `dias_desde_ultima_pesagem`/`alerta_pesagem` desta view.
--
-- Não mexe em `gmd_valido`/`gmd_kg_dia`/`atingiu_meta_gmd`, que continuam
-- exigindo 2+ pesagens reais (CLAUDE.md: GMD só é válido com 2+ pesagens).
create or replace view v_animal_indicadores as
with pesagens_validas as (
  select
    animal_id,
    data,
    peso_kg,
    row_number() over (partition by animal_id order by data desc) as rn
  from pesagens
  where peso_kg is not null
),
ultima_pesagem as (
  select animal_id, data as data_ultima_pesagem, peso_kg as peso_atual
  from pesagens_validas
  where rn = 1
),
contagem as (
  select animal_id, count(*) as num_pesagens_validas
  from pesagens_validas
  group by animal_id
)
select
  a.id as animal_id,
  a.fazenda_id,
  a.curral_id,
  a.categoria_id,
  a.brinco,
  a.data_entrada,
  coalesce(a.peso_entrada_kg, a.peso_medio_entrada_kg) as peso_entrada_kg,
  coalesce(up.peso_atual, a.peso_entrada_kg, a.peso_medio_entrada_kg) as peso_atual_kg,
  coalesce(up.data_ultima_pesagem, a.data_entrada) as data_ultima_pesagem,
  coalesce(cnt.num_pesagens_validas, 0) as num_pesagens_validas,
  (p.data_referencia - a.data_entrada) as dias_confinado,
  (p.data_referencia - coalesce(up.data_ultima_pesagem, a.data_entrada)) as dias_desde_ultima_pesagem,
  case
    when (p.data_referencia - coalesce(up.data_ultima_pesagem, a.data_entrada)) >= p.alerta_pesagem_forte_dias
    then 'critico'
    when (p.data_referencia - coalesce(up.data_ultima_pesagem, a.data_entrada)) >= p.alerta_pesagem_atencao_dias
    then 'atencao'
    else 'ok'
  end as alerta_pesagem,
  (
    coalesce(cnt.num_pesagens_validas, 0) >= 2
    and up.data_ultima_pesagem > a.data_entrada
  ) as gmd_valido,
  case
    when coalesce(cnt.num_pesagens_validas, 0) >= 2 and up.data_ultima_pesagem > a.data_entrada
    then (up.peso_atual - coalesce(a.peso_entrada_kg, a.peso_medio_entrada_kg))
         / (up.data_ultima_pesagem - a.data_entrada)::numeric
  end as gmd_kg_dia,
  coalesce(up.peso_atual, a.peso_entrada_kg, a.peso_medio_entrada_kg) / 30.0 as arroba_viva,
  (
    coalesce(up.peso_atual, a.peso_entrada_kg, a.peso_medio_entrada_kg)
    - coalesce(a.peso_entrada_kg, a.peso_medio_entrada_kg)
  ) / 30.0 as ganho_arroba,
  case
    when coalesce(cnt.num_pesagens_validas, 0) >= 2 and up.data_ultima_pesagem > a.data_entrada
    then (
      (up.peso_atual - coalesce(a.peso_entrada_kg, a.peso_medio_entrada_kg))
      / (up.data_ultima_pesagem - a.data_entrada)::numeric
    ) >= p.gmd_meta
  end as atingiu_meta_gmd
from animais a
join parametros p on p.fazenda_id = a.fazenda_id
left join ultima_pesagem up on up.animal_id = a.id
left join contagem cnt on cnt.animal_id = a.id
where a.status = 'ativo';
