create or replace function public.sat_apply_document_batch(operations jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  operation jsonb;
  applied integer := 0;
  affected integer;
begin
  if jsonb_typeof(operations) <> 'array' or jsonb_array_length(operations) > 500 then
    raise exception 'A batch must contain an array of at most 500 operations';
  end if;

  for operation in select value from jsonb_array_elements(operations)
  loop
    if operation->>'kind' = 'delete' then
      delete from public.sat_documents
      where document_path = operation->>'document_path';
    elsif operation->>'kind' = 'create_if_absent' then
      insert into public.sat_documents (
        document_path, collection_path, document_id, church_id, payload, updated_at
      ) values (
        operation->>'document_path', operation->>'collection_path',
        operation->>'document_id', operation->>'church_id',
        coalesce(operation->'payload', '{}'::jsonb), now()
      ) on conflict (document_path) do nothing;
      get diagnostics affected = row_count;
      if affected = 0 then
        raise exception using errcode = '40001', message = 'Document changed during transaction';
      end if;
    elsif operation->>'kind' = 'upsert' then
      insert into public.sat_documents (
        document_path, collection_path, document_id, church_id, payload, updated_at
      ) values (
        operation->>'document_path', operation->>'collection_path',
        operation->>'document_id', operation->>'church_id',
        coalesce(operation->'payload', '{}'::jsonb), now()
      )
      on conflict (document_path) do update set
        collection_path = excluded.collection_path,
        document_id = excluded.document_id,
        church_id = excluded.church_id,
        payload = excluded.payload,
        updated_at = now();
    else
      raise exception 'Unsupported document batch operation';
    end if;
    applied := applied + 1;
  end loop;
  return applied;
end;
$$;

revoke all on function public.sat_apply_document_batch(jsonb) from public, anon;
grant execute on function public.sat_apply_document_batch(jsonb) to authenticated;
