-- Read large Firestore-compatible collections in bounded, index-backed pages.
-- Results remain protected by sat_documents RLS because this is SECURITY INVOKER.

create or replace function public.sat_query_documents_page(
  target_collection_path text,
  filter_spec jsonb default '[]'::jsonb,
  after_document_id text default null,
  page_limit integer default 1000
)
returns setof public.sat_documents
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if target_collection_path is null or btrim(target_collection_path) = '' then
    raise exception 'Collection path is required';
  end if;
  if filter_spec is null or jsonb_typeof(filter_spec) <> 'array' then
    raise exception 'Filter specification must be an array';
  end if;
  if page_limit < 1 or page_limit > 1000 then
    raise exception 'Page limit must be between 1 and 1000';
  end if;

  return query
  select d.*
  from public.sat_documents d
  where d.collection_path = target_collection_path
    and (after_document_id is null or d.document_id > after_document_id)
    and sat_private.payload_matches_filters(d.payload, filter_spec)
  order by d.document_id asc
  limit page_limit;
end;
$$;

revoke all on function public.sat_query_documents_page(text, jsonb, text, integer) from public, anon;
grant execute on function public.sat_query_documents_page(text, jsonb, text, integer) to authenticated;

comment on function public.sat_query_documents_page(text, jsonb, text, integer) is
  'Bounded keyset page for the SAT Firestore compatibility layer; row access remains governed by sat_documents RLS.';
