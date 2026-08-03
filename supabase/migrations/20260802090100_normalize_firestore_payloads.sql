-- Convert the staged Firestore REST value envelopes into ordinary JSON for
-- application queries. The lossless source representation remains in the
-- private migration_staging schema for rollback and audit.

create or replace function sat_private.firestore_value_to_jsonb(value jsonb)
returns jsonb
language plpgsql
immutable
strict
security invoker
set search_path = ''
as $$
declare
  result jsonb;
begin
  if value ? 'nullValue' then return 'null'::jsonb; end if;
  if value ? 'booleanValue' then return value->'booleanValue'; end if;
  if value ? 'stringValue' then return to_jsonb(value->>'stringValue'); end if;
  if value ? 'timestampValue' then return to_jsonb(value->>'timestampValue'); end if;
  if value ? 'integerValue' then return to_jsonb((value->>'integerValue')::numeric); end if;
  if value ? 'doubleValue' then return value->'doubleValue'; end if;
  if value ? 'bytesValue' then return to_jsonb(value->>'bytesValue'); end if;
  if value ? 'referenceValue' then return to_jsonb(value->>'referenceValue'); end if;
  if value ? 'geoPointValue' then return value->'geoPointValue'; end if;

  if value ? 'arrayValue' then
    select coalesce(jsonb_agg(sat_private.firestore_value_to_jsonb(element)), '[]'::jsonb)
    into result
    from jsonb_array_elements(coalesce(value #> '{arrayValue,values}', '[]'::jsonb)) element;
    return result;
  end if;

  if value ? 'mapValue' then
    select coalesce(
      jsonb_object_agg(entry.key, sat_private.firestore_value_to_jsonb(entry.value)),
      '{}'::jsonb
    )
    into result
    from jsonb_each(coalesce(value #> '{mapValue,fields}', '{}'::jsonb)) entry;
    return result;
  end if;

  -- Already-normalized values are left unchanged, which keeps the function
  -- safe for idempotent reruns and future Supabase-authored documents.
  return value;
end;
$$;

create or replace function sat_private.firestore_document_to_jsonb(fields jsonb)
returns jsonb
language sql
immutable
strict
security invoker
set search_path = ''
as $$
  select coalesce(
    jsonb_object_agg(entry.key, sat_private.firestore_value_to_jsonb(entry.value)),
    '{}'::jsonb
  )
  from jsonb_each(fields) entry;
$$;

update public.sat_documents
set payload = sat_private.firestore_document_to_jsonb(payload),
    updated_at = now();

comment on function sat_private.firestore_document_to_jsonb(jsonb) is
  'Normalizes Firestore REST fields into application JSON; raw staged payloads remain unchanged.';
