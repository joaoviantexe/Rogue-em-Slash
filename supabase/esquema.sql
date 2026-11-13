-- Rogue em' Slash — banco de dados no Supabase. Baseado no do RL20 (supabase/esquema.sql).
-- Contas (perfis), amigos, chat da sala e sussurros, moedas e o bazar de itens do boneco da sala.
-- Quem joga sem conta entra com o login anônimo do Supabase (Authentication → Sign In / Providers → "Allow anonymous
-- sign-ins"): tem um perfil com o nome que digitou e pode conversar, mas não tem amigos, moedas nem itens.
-- Como usar: no painel do Supabase, abra "SQL Editor", cole este arquivo inteiro e clique em "Run".
-- Pode rodar de novo depois de uma atualização do jogo: ele só cria o que ainda não existe e recria as funções.
--
-- Segurança: as tabelas têm RLS (Row Level Security). O site usa só a chave publicável; cada jogador só lê o que é dele.
-- O que envolve outra pessoa (pedir amizade) ou as moedas (comprar) passa por funções que conferem as regras.
-- Dar moedas (dar_moedas) só roda aqui no SQL Editor: o jogo não consegue chamar.

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------

-- Perfil do jogador (o nome que aparece no jogo). Criado sozinho ao criar a conta.
create table if not exists public.perfis (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null check (char_length(nome) between 2 and 18),
  criado_em timestamptz not null default now()
);
create unique index if not exists perfis_nome_unico on public.perfis (lower(nome));
-- O visual do boneco da sala: { corpo, chapeu: { id, cor }, oculos, capacete, mascara, asas, camisa }
alter table public.perfis add column if not exists visual jsonb;
-- Último sinal do jogo aberto (a cada minuto): o nome de quem joga sem conta e sumiu fica livre (veja liberar_nome).
alter table public.perfis add column if not exists visto_em timestamptz not null default now();
-- Chave secreta de saída (só o dono lê): ao fechar a página, o jogo manda só ela (sair_convidado_chave), sem login.
alter table public.perfis add column if not exists chave_saida uuid not null default gen_random_uuid();

-- Amizades: "de" pediu para "para". Vira 'aceita' quando "para" aceita.
create table if not exists public.amizades (
  de uuid not null references auth.users (id) on delete cascade,
  para uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pendente' check (status in ('pendente', 'aceita')),
  criado_em timestamptz not null default now(),
  primary key (de, para),
  check (de <> para)
);

-- Chat da sala (para = nulo: todos leem) e sussurros (para = quem recebe: só os dois leem). Ficam um dia.
-- O nome vem do perfil (ninguém fala em nome de outro).
create table if not exists public.mensagens (
  id bigint generated always as identity primary key,
  de uuid default auth.uid() references auth.users (id) on delete set null,
  para uuid references auth.users (id) on delete cascade,
  nome text not null default '',
  para_nome text,
  texto text not null check (char_length(texto) between 1 and 200),
  criado_em timestamptz not null default now()
);
create index if not exists mensagens_criado on public.mensagens (criado_em desc);
-- (quem saiu sem conta tem o login apagado: as mensagens dele ficam, sem o vínculo)
alter table public.mensagens alter column de drop not null;
alter table public.mensagens drop constraint if exists mensagens_de_fkey;
alter table public.mensagens add constraint mensagens_de_fkey foreign key (de) references auth.users (id) on delete set null;

-- Moedas: o saldo só muda pelas funções comprar_item e dar_moedas (e, no futuro, pelo pagamento).
create table if not exists public.carteiras (
  usuario uuid primary key references auth.users (id) on delete cascade,
  moedas integer not null default 0 check (moedas >= 0),
  atualizado_em timestamptz not null default now()
);
-- Extrato: cada entrada e saída de moedas.
create table if not exists public.movimentos_moedas (
  id bigint generated always as identity primary key,
  usuario uuid not null references auth.users (id) on delete cascade,
  delta integer not null,
  motivo text not null,
  criado_em timestamptz not null default now()
);

-- Itens do bazar (o boneco da sala). preco = 0: grátis. ativo = false: sai do bazar (quem comprou continua usando).
-- Rodar este arquivo de novo só acrescenta os itens que faltam, sem mexer nos preços.
create table if not exists public.itens_bazar (
  id text primary key,
  nome text not null,
  tipo text not null,
  preco integer not null default 10 check (preco >= 0),
  ativo boolean not null default true,
  ordem integer not null default 0
);
alter table public.itens_bazar drop constraint if exists itens_bazar_tipo_check;
alter table public.itens_bazar add constraint itens_bazar_tipo_check check (tipo in ('chapeu', 'oculos', 'capacete', 'mascara', 'asas', 'camisa'));
insert into public.itens_bazar (id, nome, tipo, ordem) values
  ('cowboy', 'Chapéu de Cowboy', 'chapeu', 1), ('bruxo', 'Chapéu de Bruxo', 'chapeu', 2), ('pirata', 'Chapéu de Pirata', 'chapeu', 3),
  ('cartola', 'Cartola', 'chapeu', 4), ('bone', 'Boné', 'chapeu', 5), ('fazendeiro', 'Chapéu de Fazendeiro', 'chapeu', 6),
  ('boina', 'Boina', 'chapeu', 7),
  ('oculos', 'Óculos', 'oculos', 1), ('oculos3d', 'Óculos 3D', 'oculos', 2), ('ski', 'Óculos de Ski', 'oculos', 3),
  ('motoqueiro', 'Capacete de Motoqueiro', 'capacete', 1), ('tv', 'TV de Tubo', 'capacete', 2),
  ('hoquei', 'Máscara de Hóquei', 'mascara', 1),
  ('anjo', 'Asas de Anjo', 'asas', 1), ('borboleta', 'Asas de Borboleta', 'asas', 2), ('morcego', 'Asas de Morcego', 'asas', 3),
  ('camiseta', 'Camiseta', 'camisa', 1)
on conflict (id) do nothing;

create table if not exists public.itens_comprados (
  usuario uuid not null references auth.users (id) on delete cascade,
  item text not null references public.itens_bazar (id) on delete cascade,
  preco_pago integer not null default 0,
  criado_em timestamptz not null default now(),
  primary key (usuario, item)
);

-- ---------------------------------------------------------------------------
-- Funções
-- ---------------------------------------------------------------------------

-- ----- nomes de quem joga sem conta -----
-- O nome de quem joga sem conta fica reservado só enquanto ele joga: ao sair, o jogo apaga o login anônimo dele
-- (sair_convidado); se o jogo fechou sem avisar, o nome fica livre quando ele está sem sinal há mais de 3 minutos.
create or replace function public.convidado_parado(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfis pf join auth.users u on u.id = pf.id
    where pf.id = p and u.is_anonymous and pf.visto_em < now() - interval '3 minutes');
$$;

-- Libera o nome de um convidado parado (apaga o login anônimo dele). Devolve true se o nome está livre.
create or replace function public.liberar_nome(n text) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  dono uuid;
begin
  select id into dono from perfis where lower(nome) = lower(trim(n));
  if dono is null then return true; end if;
  if dono is distinct from auth.uid() and convidado_parado(dono) then
    delete from auth.users where id = dono;
    return true;
  end if;
  return false;
end $$;

-- O jogo está aberto (o jogo chama a cada minuto).
create or replace function public.marcar_visto() returns void
language sql security definer set search_path = public as $$
  update perfis set visto_em = now() where id = auth.uid();
$$;

-- Quem joga sem conta saiu: apaga o login anônimo (o perfil vai junto e o nome fica livre).
create or replace function public.sair_convidado() returns void
language sql security definer set search_path = public as $$
  delete from auth.users where id = auth.uid() and is_anonymous;
$$;

-- O mesmo, ao fechar a página: o navegador só consegue mandar um texto simples (navigator.sendBeacon), sem o login;
-- vai a chave de saída do convidado. (Um parâmetro de texto sem nome: o PostgREST aceita o corpo em text/plain.)
create or replace function public.sair_convidado_chave(text) returns void
language sql security definer set search_path = public as $$
  delete from auth.users u using perfis p
  where p.id = u.id and u.is_anonymous and p.chave_saida::text = trim($1);
$$;

-- Cria o perfil quando alguém cria a conta (o nome vem do cadastro; se já existir, ganha um sufixo).
create or replace function public.criar_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  base text := left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'nome'), ''), split_part(new.email, '@', 1)), 18);
  nome_final text := base;
begin
  if char_length(base) < 2 then base := 'Jogador'; nome_final := base; end if;
  perform liberar_nome(nome_final);   -- (o nome de um convidado que sumiu fica livre)
  if exists (select 1 from perfis where lower(nome) = lower(nome_final)) then
    nome_final := left(base, 13) || '#' || substr(md5(new.id::text), 1, 4);
  end if;
  insert into perfis (id, nome) values (new.id, nome_final);
  return new;
end $$;

drop trigger if exists ao_criar_conta on auth.users;
create trigger ao_criar_conta after insert on auth.users
  for each row execute function public.criar_perfil();

-- Nome livre? (a tela de cadastro pergunta antes de criar a conta)
create or replace function public.nome_disponivel(n text) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from perfis where lower(nome) = lower(trim(n)) and not convidado_parado(id));
$$;

-- Quem está jogando sem conta (login anônimo)?
create or replace function public.eh_anonimo() returns boolean
language sql stable as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false);
$$;

-- Troca o nome de jogador (Configurações no celular; sem conta, o nome digitado ao entrar). Devolve 'ok', 'invalido' ou 'em_uso'.
create or replace function public.trocar_nome(n text) returns text
language plpgsql security definer set search_path = public as $$
declare
  novo text := trim(n);
begin
  if auth.uid() is null then raise exception 'sem login'; end if;
  if novo !~ '^[[:alnum:] _.-]{2,18}$' then return 'invalido'; end if;
  perform liberar_nome(novo);
  if exists (select 1 from perfis where lower(nome) = lower(novo) and id <> auth.uid()) then return 'em_uso'; end if;
  update perfis set nome = novo where id = auth.uid();
  return 'ok';
exception when unique_violation then
  return 'em_uso';
end $$;

-- ----- amigos -----
create or replace function public.sao_amigos(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from amizades
    where status = 'aceita' and ((de = a and para = b) or (de = b and para = a)));
$$;

-- Pede amizade (pelo id: clicando no jogador na sala; ou pelo nome: no app Amigos). Se a outra pessoa já tinha
-- pedido, vira amizade na hora. Devolve 'enviado', 'aceita', 'ja_existe', 'voce_mesmo', 'nao_encontrado' ou 'convidado'
-- (a outra pessoa está sem conta). Sem conta não dá para pedir.
create or replace function public.pedir_amizade(alvo uuid default null, n text default null) returns text
language plpgsql security definer set search_path = public as $$
declare
  eu uuid := auth.uid();
begin
  if eu is null or eh_anonimo() then raise exception 'precisa de conta'; end if;
  if alvo is null and n is not null then select id into alvo from perfis where lower(nome) = lower(trim(n)); end if;
  if alvo is null or not exists (select 1 from perfis where id = alvo) then return 'nao_encontrado'; end if;
  if alvo = eu then return 'voce_mesmo'; end if;
  if exists (select 1 from auth.users where id = alvo and is_anonymous) then return 'convidado'; end if;
  if sao_amigos(eu, alvo) or exists (select 1 from amizades where de = eu and para = alvo) then return 'ja_existe'; end if;
  if exists (select 1 from amizades where de = alvo and para = eu) then
    update amizades set status = 'aceita' where de = alvo and para = eu;
    return 'aceita';
  end if;
  insert into amizades (de, para) values (eu, alvo);
  return 'enviado';
end $$;

create or replace function public.responder_amizade(outro uuid, aceitar boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if aceitar then
    update amizades set status = 'aceita' where de = outro and para = auth.uid() and status = 'pendente';
  else
    delete from amizades where de = outro and para = auth.uid() and status = 'pendente';
  end if;
end $$;

-- Desfaz a amizade (ou cancela o pedido enviado).
create or replace function public.remover_amizade(outro uuid) returns void
language sql security definer set search_path = public as $$
  delete from amizades where (de = auth.uid() and para = outro) or (de = outro and para = auth.uid());
$$;

-- Amigos e pedidos: situacao = 'amigo', 'enviado' (eu pedi) ou 'recebido' (pediram para mim).
create or replace function public.meus_amigos()
returns table (id uuid, nome text, situacao text)
language sql stable security definer set search_path = public as $$
  select p.id, p.nome,
    case when a.status = 'aceita' then 'amigo' when a.de = auth.uid() then 'enviado' else 'recebido' end
  from amizades a
  join perfis p on p.id = case when a.de = auth.uid() then a.para else a.de end
  where auth.uid() in (a.de, a.para)
  order by 3, 2;
$$;

-- ----- chat -----
-- Antes de gravar: quem manda é quem está conectado, o nome vem do perfil, o texto é limpo, no máximo 1 mensagem por
-- segundo, e as de mais de um dia saem.
create or replace function public.antes_mensagem() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.de := auth.uid();
  select nome into new.nome from perfis where id = new.de;
  if new.nome is null then raise exception 'sem perfil'; end if;
  if new.para is not null then
    if new.para = new.de then raise exception 'sussurro para si mesmo'; end if;
    select nome into new.para_nome from perfis where id = new.para;
    if new.para_nome is null then raise exception 'jogador não encontrado'; end if;
  else
    new.para_nome := null;
  end if;
  new.texto := left(regexp_replace(trim(new.texto), '\s+', ' ', 'g'), 200);
  new.criado_em := now();
  if exists (select 1 from mensagens where de = new.de and criado_em > now() - interval '1 second') then
    raise exception 'devagar';
  end if;
  delete from mensagens where criado_em < now() - interval '1 day';
  return new;
end $$;

drop trigger if exists antes_mensagem on public.mensagens;
create trigger antes_mensagem before insert on public.mensagens
  for each row execute function public.antes_mensagem();

-- As mensagens chegam na hora pelo Realtime do Supabase (respeitando as regras de quem lê o quê).
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'mensagens') then
    alter publication supabase_realtime add table public.mensagens;
  end if;
end $$;

-- ----- moedas e bazar -----
-- Compra um item do bazar com moedas. Devolve o saldo que sobrou.
create or replace function public.comprar_item(item text) returns integer
language plpgsql security definer set search_path = public as $$
declare
  eu uuid := auth.uid();
  p integer;
  saldo integer;
begin
  if eu is null or eh_anonimo() then raise exception 'precisa de conta'; end if;
  select preco into p from itens_bazar where id = item and ativo;
  if p is null then raise exception 'item indisponível'; end if;
  if exists (select 1 from itens_comprados where usuario = eu and itens_comprados.item = comprar_item.item) then raise exception 'já comprado'; end if;
  insert into carteiras (usuario) values (eu) on conflict do nothing;
  select moedas into saldo from carteiras where usuario = eu for update;
  if saldo < p then raise exception 'moedas insuficientes'; end if;
  update carteiras set moedas = moedas - p, atualizado_em = now() where usuario = eu;
  insert into itens_comprados (usuario, item, preco_pago) values (eu, comprar_item.item, p);
  insert into movimentos_moedas (usuario, delta, motivo) values (eu, -p, 'compra: ' || comprar_item.item);
  return saldo - p;
end $$;

-- Dá (ou, com qtd negativa, tira) moedas de um jogador pelo nome. Só roda aqui no SQL Editor do Supabase.
-- Ex.: select public.dar_moedas('Fulano', 100);
create or replace function public.dar_moedas(n text, qtd integer, motivo text default 'bônus') returns integer
language plpgsql security definer set search_path = public as $$
declare
  alvo uuid;
  saldo integer;
begin
  select id into alvo from perfis where lower(nome) = lower(trim(n));
  if alvo is null then raise exception 'jogador não encontrado: %', n; end if;
  insert into carteiras (usuario) values (alvo) on conflict do nothing;
  update carteiras set moedas = greatest(0, moedas + qtd), atualizado_em = now() where usuario = alvo returning moedas into saldo;
  insert into movimentos_moedas (usuario, delta, motivo) values (alvo, qtd, motivo);
  return saldo;
end $$;

-- Salva o visual do boneco da sala (só com itens comprados ou grátis).
create or replace function public.salvar_visual(v jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  eu uuid := auth.uid();
  s text;
  it text;
begin
  if eu is null then raise exception 'sem login'; end if;
  if v is null or jsonb_typeof(v) <> 'object' or length(v::text) > 1000 then raise exception 'visual inválido'; end if;
  foreach s in array array['chapeu', 'oculos', 'capacete', 'mascara', 'asas', 'camisa'] loop
    it := v -> s ->> 'id';
    if it is not null and not exists (select 1 from itens_bazar b where b.id = it and b.tipo = s
        and (b.preco = 0 or exists (select 1 from itens_comprados c where c.usuario = eu and c.item = it))) then
      raise exception 'item não comprado: %', it;
    end if;
  end loop;
  update perfis set visual = v where id = eu;
end $$;

-- ---------------------------------------------------------------------------
-- Permissões (RLS)
-- ---------------------------------------------------------------------------
alter table public.perfis enable row level security;
alter table public.amizades enable row level security;
alter table public.mensagens enable row level security;
alter table public.carteiras enable row level security;
alter table public.movimentos_moedas enable row level security;
alter table public.itens_bazar enable row level security;
alter table public.itens_comprados enable row level security;

-- perfis: cada um lê o seu (os nomes dos amigos vêm da função meus_amigos); mudar, só pelas funções
drop policy if exists perfis_ler on public.perfis;
create policy perfis_ler on public.perfis for select to authenticated
  using (id = auth.uid());

-- amizades: cada um vê as suas; criar, aceitar e desfazer só pelas funções
drop policy if exists amizades_ler on public.amizades;
create policy amizades_ler on public.amizades for select to authenticated
  using (auth.uid() in (de, para));

-- mensagens: o chat da sala todos leem; o sussurro, só quem mandou e quem recebeu; mandar pede um login (a conta ou o
-- anônimo de quem joga sem conta)
drop policy if exists mensagens_ler on public.mensagens;
drop policy if exists mensagens_ler_sala on public.mensagens;
drop policy if exists mensagens_enviar on public.mensagens;
create policy mensagens_ler_sala on public.mensagens for select to anon
  using (para is null);
create policy mensagens_ler on public.mensagens for select to authenticated
  using (para is null or auth.uid() in (de, para));
create policy mensagens_enviar on public.mensagens for insert to authenticated
  with check (de = auth.uid());

-- moedas: cada um vê o seu saldo, o seu extrato e as suas compras; os itens do bazar todos veem
drop policy if exists carteiras_ler on public.carteiras;
create policy carteiras_ler on public.carteiras for select to authenticated
  using (usuario = auth.uid());
drop policy if exists movimentos_ler on public.movimentos_moedas;
create policy movimentos_ler on public.movimentos_moedas for select to authenticated
  using (usuario = auth.uid());
drop policy if exists itens_ler on public.itens_bazar;
create policy itens_ler on public.itens_bazar for select to anon, authenticated
  using (true);
drop policy if exists comprados_ler on public.itens_comprados;
create policy comprados_ler on public.itens_comprados for select to authenticated
  using (usuario = auth.uid());

-- Funções que o site chama (as outras ficam fechadas: dar_moedas só roda no SQL Editor)
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.nome_disponivel(text), public.sair_convidado_chave(text) to anon, authenticated;
grant execute on function public.marcar_visto(), public.sair_convidado(), public.trocar_nome(text), public.pedir_amizade(uuid, text), public.responder_amizade(uuid, boolean),
  public.remover_amizade(uuid), public.meus_amigos(), public.comprar_item(text), public.salvar_visual(jsonb) to authenticated;
