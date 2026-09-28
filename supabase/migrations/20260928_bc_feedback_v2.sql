-- BC feedback v2 (docs/QUESTIONS-v2.md). Additive only: v1 columns/rows stay. RLS deny-all unchanged.
alter table public.feedback_mentor
  add column if not exists data date,
  add column if not exists vieta text,
  add column if not exists vaiku_sk smallint check (vaiku_sk between 0 and 60),
  add column if not exists patiko text,
  add column if not exists nepatiko text,
  add column if not exists neistrigo text,
  add column if not exists zaidimas_veike text check (zaidimas_veike in ('taip','dalinai','ne')),
  add column if not exists salmai_veike text check (salmai_veike in ('taip','dalinai','ne')),
  add column if not exists problemu_tipai text[] check (problemu_tipai <@ array['šalmas','baterija','žaidimas','casting','wifi','instrukcija','laikas','elgesys','kita']::text[]),
  add column if not exists problema text,
  add column if not exists instrukcija_aiski text check (instrukcija_aiski in ('taip','dalinai','ne')),
  add column if not exists kur_strigo text,
  add column if not exists pasitikejimas smallint check (pasitikejimas between 1 and 5),
  add column if not exists istorija_vaikams smallint check (istorija_vaikams between 1 and 5),
  add column if not exists ismoko text,
  add column if not exists idomiausia text,
  add column if not exists prase_daugiau text,
  add column if not exists vaiko_citata text,
  add column if not exists ivertinimas smallint check (ivertinimas between 1 and 10),
  add column if not exists versija smallint not null default 1,
  add column if not exists slack text;

-- kids: v1 = 4 rows per child (klausimas/atsakymas 1-4, BC Jr keeps this) · v2 = ONE row per child, enum codes only
alter table public.feedback_vaikai alter column klausimas drop not null, alter column atsakymas drop not null;
alter table public.feedback_vaikai
  add column if not exists vieta text check (char_length(vieta) <= 60),
  add column if not exists data date,
  add column if not exists ivertinimas smallint check (ivertinimas between 1 and 10),
  add column if not exists smagiausia text check (smagiausia in ('istorija','vr_zaidimas','komanda','uzduotis','mentorius','kita')),
  add column if not exists nepatiko text check (nepatiko in ('nieko','laukti','per_sunku','per_lengva','salmas','nesupratau','kita')),
  add column if not exists ismoko text check (ismoko ~ '^[a-z0-9_]{1,24}$'),
  add column if not exists panaudos text check (panaudos in ('seimai','namie','draugui','mokykloje','nezinau')),
  add column if not exists daugiau text check (daugiau in ('vr','zaidimu','istorijos','sunkesniu','laiko')),
  add column if not exists rekomenduotu text check (rekomenduotu in ('taip','gal','ne')),
  add column if not exists kodel text check (kodel ~ '^[a-z_]{1,24}$'),
  add column if not exists versija smallint not null default 1;
alter table public.feedback_vaikai add constraint feedback_vaikai_shape check (
  (versija = 1 and klausimas is not null and atsakymas is not null) or
  (versija = 2 and klausimas is null and ivertinimas is not null));
create index if not exists feedback_vaikai_lesson_idx on public.feedback_vaikai (program, pamoka, data);

-- Slack de-dup: set when a row was posted (edge fn) or marked (bin/feedback-digest.py --mark-posted)
alter table public.feedback_mentor add column if not exists slack_posted_at timestamptz;
alter table public.feedback_vaikai add column if not exists slack_posted_at timestamptz;
