-- Rogue em' Slash — banco de dados no Supabase (contas). Baseado no do RL20 (supabase/esquema.sql).
-- Como usar: no painel do Supabase, abra "SQL Editor", cole este arquivo inteiro e clique em "Run".
-- Pode rodar de novo depois de uma atualização do jogo: ele só cria o que ainda não existe e recria as funções.
--
-- Segurança: as tabelas têm RLS (Row Level Security). O site usa só a chave publicável; cada jogador só lê o que é dele.

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------

-- Perfil do jogador (o nome que aparece no jogo e nas salas online). Criado sozinho ao criar a conta.
create table if not exists public.perfis (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null check (char_length(nome) between 2 and 18),
  criado_em timestamptz not null default now()
);
create unique index if not exists perfis_nome_unico on public.perfis (lower(nome));

-- ---------------------------------------------------------------------------
-- Funções
-- ---------------------------------------------------------------------------

-- Cria o perfil quando alguém cria a conta (o nome vem do cadastro; se já existir, ganha um sufixo).
create or replace function public.criar_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  base text := left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'nome'), ''), split_part(new.email, '@', 1)), 18);
  nome_final text := base;
begin
  if char_length(base) < 2 then base := 'Jogador'; nome_final := base; end if;
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
  select not exists (select 1 from perfis where lower(nome) = lower(trim(n)));
$$;

-- ---------------------------------------------------------------------------
-- Permissões (RLS)
-- ---------------------------------------------------------------------------
alter table public.perfis enable row level security;

drop policy if exists perfis_ler on public.perfis;
create policy perfis_ler on public.perfis for select to authenticated
  using (id = auth.uid());
-- (sem regra de inserir, mudar ou apagar: o perfil só é criado pela função acima)

revoke execute on all functions in schema public from public, anon;
grant execute on function public.nome_disponivel(text) to anon, authenticated;
