create or replace function sat_private.payload_matches_filters(target_payload jsonb, filter_spec jsonb)
returns boolean
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  item jsonb;
  actual jsonb;
  expected jsonb;
  operator text;
  field_name text;
begin
  if filter_spec is null or jsonb_typeof(filter_spec) <> 'array' then return true; end if;
  for item in select value from jsonb_array_elements(filter_spec)
  loop
    field_name := item->>'field';
    operator := item->>'operator';
    if field_name is null or field_name !~ '^[A-Za-z0-9_.]+$' then return false; end if;
    if operator not in ('==','!=','<','<=','>','>=','in','array-contains') then return false; end if;
    actual := target_payload #> string_to_array(field_name, '.');
    expected := item->'value';

    if operator = '==' and actual is distinct from expected then return false; end if;
    if operator = '!=' and (actual is null or actual is not distinct from expected) then return false; end if;
    if operator = 'in' and (
      actual is null or jsonb_typeof(expected) <> 'array'
      or not exists (select 1 from jsonb_array_elements(expected) candidate where candidate = actual)
    ) then return false; end if;
    if operator = 'array-contains' and (
      actual is null or jsonb_typeof(actual) <> 'array' or not (actual @> jsonb_build_array(expected))
    ) then return false; end if;

    if operator in ('<','<=','>','>=') then
      if actual is null or jsonb_typeof(actual) <> jsonb_typeof(expected) then return false; end if;
      if jsonb_typeof(actual) = 'number' then
        if operator = '<'  and not ((actual #>> '{}')::numeric <  (expected #>> '{}')::numeric) then return false; end if;
        if operator = '<=' and not ((actual #>> '{}')::numeric <= (expected #>> '{}')::numeric) then return false; end if;
        if operator = '>'  and not ((actual #>> '{}')::numeric >  (expected #>> '{}')::numeric) then return false; end if;
        if operator = '>=' and not ((actual #>> '{}')::numeric >= (expected #>> '{}')::numeric) then return false; end if;
      elsif jsonb_typeof(actual) = 'string' then
        if operator = '<'  and not ((actual #>> '{}') collate "C" <  (expected #>> '{}') collate "C") then return false; end if;
        if operator = '<=' and not ((actual #>> '{}') collate "C" <= (expected #>> '{}') collate "C") then return false; end if;
        if operator = '>'  and not ((actual #>> '{}') collate "C" >  (expected #>> '{}') collate "C") then return false; end if;
        if operator = '>=' and not ((actual #>> '{}') collate "C" >= (expected #>> '{}') collate "C") then return false; end if;
      else
        return false;
      end if;
    end if;
  end loop;
  return true;
end;
$$;

create or replace function public.sat_query_documents(
  target_collection_path text,
  filter_spec jsonb default '[]'::jsonb,
  order_spec jsonb default '[]'::jsonb,
  row_limit integer default null
)
returns setof public.sat_documents
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  statement text := 'select d.* from public.sat_documents d where d.collection_path = $1 and sat_private.payload_matches_filters(d.payload, $2)';
  item jsonb;
  field_name text;
  direction text;
  first_order boolean := true;
begin
  if row_limit is not null and (row_limit < 1 or row_limit > 1000) then
    raise exception 'Query row limit must be between 1 and 1000';
  end if;
  if jsonb_typeof(order_spec) <> 'array' or jsonb_array_length(order_spec) > 4 then
    raise exception 'Order specification must contain at most four fields';
  end if;

  if jsonb_array_length(order_spec) > 0 then statement := statement || ' order by '; end if;
  for item in select value from jsonb_array_elements(order_spec)
  loop
    field_name := item->>'field';
    direction := lower(coalesce(item->>'direction', 'asc'));
    if field_name is null or field_name !~ '^[A-Za-z0-9_.]+$' or direction not in ('asc','desc') then
      raise exception 'Invalid document order specification';
    end if;
    if not first_order then statement := statement || ', '; end if;
    statement := statement || format(
      'case when jsonb_typeof(d.payload #> string_to_array(%L,''.'')) = ''number'' then (d.payload #>> string_to_array(%L,''.''))::numeric end %s nulls last, d.payload #>> string_to_array(%L,''.'') %s nulls last',
      field_name, field_name, direction, field_name, direction
    );
    first_order := false;
  end loop;
  if jsonb_array_length(order_spec) > 0 then statement := statement || ', '; else statement := statement || ' order by '; end if;
  statement := statement || 'd.document_id asc';
  if row_limit is not null then statement := statement || format(' limit %s', row_limit); end if;
  return query execute statement using target_collection_path, filter_spec;
end;
$$;

revoke all on function public.sat_query_documents(text, jsonb, jsonb, integer) from public, anon;
grant execute on function public.sat_query_documents(text, jsonb, jsonb, integer) to authenticated;
