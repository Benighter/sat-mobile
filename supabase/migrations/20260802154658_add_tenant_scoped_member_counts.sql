create or replace function public.sat_get_member_counts(target_church_ids text[])
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  normalized_ids text[];
  counts_value jsonb;
  total_value bigint;
begin
  if not sat_private.is_sat_firebase_token() then
    raise exception 'Invalid identity token';
  end if;

  select coalesce(array_agg(distinct trim(church_id) order by trim(church_id)), array[]::text[])
  into normalized_ids
  from unnest(coalesce(target_church_ids, array[]::text[])) church_id
  where nullif(trim(church_id), '') is not null;

  if cardinality(normalized_ids) = 0 or cardinality(normalized_ids) > 300 then
    raise exception 'Between 1 and 300 church IDs are required';
  end if;

  if exists (
    select 1
    from unnest(normalized_ids) church_id
    where not sat_private.has_church_access(church_id)
  ) then
    raise exception 'One or more requested churches are outside the caller scope';
  end if;

  with requested as (
    select unnest(normalized_ids) as church_id
  ),
  member_counts as (
    select
      r.church_id,
      count(d.document_path)::bigint as member_count
    from requested r
    left join public.sat_documents d
      on d.collection_path = 'churches/' || r.church_id || '/members'
     and lower(coalesce(d.payload->>'isActive', 'true')) <> 'false'
    group by r.church_id
  )
  select
    coalesce(jsonb_object_agg(church_id, member_count order by church_id), '{}'::jsonb),
    coalesce(sum(member_count), 0)
  into counts_value, total_value
  from member_counts;

  return jsonb_build_object('counts', counts_value, 'total', total_value);
end;
$$;

revoke all on function public.sat_get_member_counts(text[]) from public, anon;
grant execute on function public.sat_get_member_counts(text[]) to authenticated;

comment on function public.sat_get_member_counts(text[]) is
  'Returns live active-member counts for authorized church scopes; replaces drift-prone Firebase cached counters and member-count triggers.';

notify pgrst, 'reload schema';
