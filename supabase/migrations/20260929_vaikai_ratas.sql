-- BC feedback v3: "Vaikų ratas" voice call. The MENTOR runs the call in front of the class, the agent speaks
-- each kid question aloud, the mentor relays the group's answers (hands count + short summary).
-- Aggregate only: no child names, voices, ages or genders. One row per call. RLS deny-all (service_role only).
create table if not exists public.feedback_vaikai_ratas (
  id bigint generated always as identity primary key,
  ts timestamptz not null default now(),
  program text not null default 'vr',
  conversation_id text unique,
  agent_id text,
  pamoka text check (char_length(pamoka) <= 6),
  vieta text check (char_length(vieta) <= 60),
  data date,
  data_text text check (char_length(data_text) <= 40),
  vaiku_sk smallint check (vaiku_sk between 0 and 60),
  ivertinimas_vid numeric(3,1) check (ivertinimas_vid between 1 and 10),
  smagiausia text check (char_length(smagiausia) <= 400),
  nepatiko text check (char_length(nepatiko) <= 400),
  ismoko text check (char_length(ismoko) <= 400),
  panaudos text check (char_length(panaudos) <= 400),
  daugiau text check (char_length(daugiau) <= 400),
  rekomenduotu_kiek text check (char_length(rekomenduotu_kiek) <= 40),
  rekomenduotu_n smallint check (rekomenduotu_n between 0 and 60),
  kodel text check (char_length(kodel) <= 400),
  vaiko_citata text check (char_length(vaiko_citata) <= 300),
  trukme_s integer,
  eval jsonb,
  is_test boolean not null default false,
  slack text,
  slack_posted_at timestamptz
);
alter table public.feedback_vaikai_ratas enable row level security;
revoke all on public.feedback_vaikai_ratas from anon, authenticated;
create index if not exists feedback_vaikai_ratas_lesson_idx on public.feedback_vaikai_ratas (program, pamoka, data);
