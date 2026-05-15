create extension if not exists vector;

create table if not exists documents (
  id uuid primary key,
  title text not null,
  file_name text not null,
  mime_type text not null,
  file_type text not null check (file_type in ('pdf', 'text', 'markdown')),
  file_size bigint not null,
  status text not null check (status in ('ready', 'failed')),
  page_count integer not null default 0,
  storage_path text not null,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists document_pages (
  id uuid primary key,
  document_id uuid not null references documents(id) on delete cascade,
  page_number integer not null,
  text text not null,
  unique (document_id, page_number)
);

create table if not exists document_chunks (
  id uuid primary key,
  document_id uuid not null references documents(id) on delete cascade,
  page_number integer not null,
  chunk_index integer not null,
  text text not null,
  snippet text not null,
  embedding vector(1536),
  unique (document_id, chunk_index)
);

create table if not exists teaching_sessions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references teaching_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  page_number integer,
  snippet text,
  created_at timestamptz not null default now()
);

create index if not exists document_pages_document_id_idx on document_pages(document_id);
create index if not exists document_chunks_document_id_idx on document_chunks(document_id);
create index if not exists document_chunks_embedding_idx on document_chunks using ivfflat (embedding vector_cosine_ops);

create or replace function match_document_chunks(
  match_document_id uuid,
  query_embedding vector(1536),
  match_count integer default 5
)
returns table (
  id uuid,
  document_id uuid,
  page_number integer,
  chunk_index integer,
  text text,
  snippet text,
  similarity float
)
language sql stable
as $$
  select
    document_chunks.id,
    document_chunks.document_id,
    document_chunks.page_number,
    document_chunks.chunk_index,
    document_chunks.text,
    document_chunks.snippet,
    1 - (document_chunks.embedding <=> query_embedding) as similarity
  from document_chunks
  where document_chunks.document_id = match_document_id
    and document_chunks.embedding is not null
  order by document_chunks.embedding <=> query_embedding
  limit match_count;
$$;
