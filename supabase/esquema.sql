-- Marco de casa: tablas, permisos y almacenamiento de fotos.
-- Pegar entero en Supabase → SQL Editor → Run. Se puede ejecutar más de una vez.
-- Regla general: solo una sesión iniciada (la cuenta de la casa) puede leer o escribir.

create table if not exists tareas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (char_length(titulo) between 1 and 80),
  quien text not null default '',
  hecha boolean not null default false,
  creada timestamptz not null default now(),
  hecha_en timestamptz
);

create table if not exists compra (
  clave text primary key,                 -- el nombre en minúsculas: "leche"
  nombre text not null check (char_length(nombre) between 1 and 60),
  cantidad int not null default 1 check (cantidad between 1 and 99),
  comprado boolean not null default false,
  creado timestamptz not null default now()
);

create table if not exists habituales (   -- "Comprar otra vez"
  nombre text primary key check (char_length(nombre) between 1 and 40),
  orden int not null default 0
);

create table if not exists fotos (
  id uuid primary key default gen_random_uuid(),
  ruta text not null,                     -- en el almacenamiento "fotos"
  miniatura text,
  ancho int, alto int,
  creada timestamptz not null default now()
);

create table if not exists calendario (   -- una sola fila; la rellena la Action de GitHub
  id int primary key default 1 check (id = 1),
  eventos jsonb not null default '[]',
  actualizado timestamptz
);
insert into calendario (id) values (1) on conflict do nothing;

create table if not exists luz (          -- precio PVPC por horas; lo rellena la Action
  id int primary key default 1 check (id = 1),
  horas jsonb not null default '[]',
  actualizado timestamptz
);
insert into luz (id) values (1) on conflict do nothing;

-- permisos: todo cerrado salvo para usuarios con sesión.
-- Las tablas no se exponen solas (opción "Automatically expose new tables" desactivada): se dan permisos
-- solo al rol "authenticated" (la cuenta de la casa). El rol "anon" (cualquiera sin sesión) no recibe nada.
grant usage on schema public to authenticated;
grant select, insert, update, delete on tareas, compra, habituales, fotos to authenticated;
grant select on calendario, luz to authenticated;
revoke all on tareas, compra, habituales, fotos, calendario, luz from anon;

alter table tareas enable row level security;
alter table compra enable row level security;
alter table habituales enable row level security;
alter table fotos enable row level security;
alter table calendario enable row level security;
alter table luz enable row level security;

do $$
declare t text;
begin
  foreach t in array array['tareas','compra','habituales','fotos'] loop
    execute format('drop policy if exists "casa" on %I', t);
    execute format('create policy "casa" on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;
drop policy if exists "casa lee" on calendario;
create policy "casa lee" on calendario for select to authenticated using (true);   -- escribir: solo la Action
drop policy if exists "casa lee" on luz;
create policy "casa lee" on luz for select to authenticated using (true);

-- lo que se compra a menudo, para empezar
insert into habituales (nombre, orden) values
  ('Leche',1),('Huevos',2),('Pan',3),('Plátanos',4),('Café',5),('Aceite',6),('Queso',7),('Yogures',8),
  ('Manzanas',9),('Pollo',10),('Arroz',11),('Pasta',12),('Tomates',13),('Cebollas',14),('Patatas',15),
  ('Papel higiénico',16),('Lavavajillas',17),('Bolsas de basura',18)
on conflict do nothing;

-- almacenamiento privado para las fotos
insert into storage.buckets (id, name, public) values ('fotos', 'fotos', false) on conflict (id) do nothing;
drop policy if exists "casa fotos" on storage.objects;
create policy "casa fotos" on storage.objects for all to authenticated
  using (bucket_id = 'fotos') with check (bucket_id = 'fotos');
