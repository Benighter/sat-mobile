create or replace function sat_private.apply_chat_message_metadata()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  thread_path text;
  thread_payload jsonb;
  participants jsonb;
  unread_counts jsonb;
  participant_id text;
  sender_id text := nullif(new.payload->>'senderId', '');
  sender_name text;
  preview_text text;
  now_text text := pg_catalog.to_char(pg_catalog.clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  current_unread bigint;
begin
  if new.collection_path !~ '(^chatThreads/[^/]+/messages$)|(^churches/[^/]+/chatThreads/[^/]+/messages$)' then
    return new;
  end if;

  thread_path := pg_catalog.regexp_replace(new.collection_path, '/messages$', '');
  select d.payload into thread_payload
  from public.sat_documents d
  where d.document_path = thread_path
  for update;

  if thread_payload is null then
    return new;
  end if;

  preview_text := pg_catalog.btrim(coalesce(new.payload->>'text', ''));
  if preview_text = '' then
    preview_text := case
      when pg_catalog.jsonb_typeof(new.payload->'attachments') = 'array'
       and pg_catalog.jsonb_array_length(new.payload->'attachments') > 0 then 'Photo'
      else 'New message'
    end;
  end if;
  preview_text := pg_catalog.left(preview_text, 500);
  sender_name := coalesce(
    nullif(new.payload->>'senderName', ''),
    case when sender_id is not null then nullif(thread_payload #>> array['participantProfiles', sender_id, 'name'], '') end,
    'New message'
  );
  participants := case
    when pg_catalog.jsonb_typeof(thread_payload->'participants') = 'array' then thread_payload->'participants'
    else '[]'::jsonb
  end;
  unread_counts := case
    when pg_catalog.jsonb_typeof(thread_payload->'unreadCounts') = 'object' then thread_payload->'unreadCounts'
    else '{}'::jsonb
  end;

  for participant_id in select value from pg_catalog.jsonb_array_elements_text(participants)
  loop
    if participant_id = sender_id then
      continue;
    end if;
    current_unread := case
      when coalesce(unread_counts->>participant_id, '') ~ '^[0-9]+$' then (unread_counts->>participant_id)::bigint
      else 0
    end;
    unread_counts := pg_catalog.jsonb_set(unread_counts, array[participant_id], pg_catalog.to_jsonb(current_unread + 1), true);
  end loop;

  update public.sat_documents
  set payload = pg_catalog.jsonb_set(
        pg_catalog.jsonb_set(
          pg_catalog.jsonb_set(
            payload,
            '{lastMessage}',
            pg_catalog.jsonb_build_object(
              'text', preview_text,
              'senderId', sender_id,
              'senderName', sender_name,
              'at', now_text
            ),
            true
          ),
          '{updatedAt}',
          pg_catalog.to_jsonb(now_text),
          true
        ),
        '{unreadCounts}',
        unread_counts,
        true
      ),
      source_checksum = null,
      updated_at = pg_catalog.clock_timestamp()
  where document_path = thread_path;

  return new;
end;
$$;

revoke all on function sat_private.apply_chat_message_metadata() from public, anon, authenticated;

drop trigger if exists sat_chat_message_metadata on public.sat_documents;
create trigger sat_chat_message_metadata
after insert on public.sat_documents
for each row
when (
  new.collection_path ~ '(^chatThreads/[^/]+/messages$)|(^churches/[^/]+/chatThreads/[^/]+/messages$)'
)
execute function sat_private.apply_chat_message_metadata();

comment on function sat_private.apply_chat_message_metadata() is
  'Maintains Supabase chat thread preview and unread counters for newly inserted messages; Firebase remains responsible for FCM delivery during rollback mode.';

create or replace function sat_private.create_deletion_request_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  church_value text := new.church_id;
  requester_id text := coalesce(nullif(new.payload->>'requestedBy', ''), nullif(new.payload->>'requesterId', ''));
  requester_name text := coalesce(nullif(new.payload->>'requestedByName', ''), nullif(new.payload->>'leaderName', ''), 'Unknown Leader');
  member_name text := coalesce(nullif(new.payload->>'memberName', ''), case when new.payload->>'target' = 'account' then 'a user account' else 'a member' end);
  reason_text text := coalesce(new.payload->>'reason', '');
  recipient_id text;
  recipient_ids text[] := array[]::text[];
  linked_admin_id text;
  description_text text;
  now_value timestamptz := pg_catalog.clock_timestamp();
  now_text text;
begin
  if new.collection_path !~ '^churches/[^/]+/memberDeletionRequests$'
     or lower(coalesce(new.payload->>'status', 'pending')) <> 'pending' then
    return new;
  end if;

  now_text := pg_catalog.to_char(now_value at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  description_text := requester_name || ' requested deletion for ' || member_name
    || case when reason_text <> '' then ': ' || reason_text else '' end;

  if requester_id is not null then
    select nullif(d.payload->>'invitedByAdminId', '') into linked_admin_id
    from public.sat_documents d
    where d.document_path = 'users/' || requester_id;

    if linked_admin_id is not null and exists (
      select 1 from public.sat_documents admin_doc
      where admin_doc.document_path = 'users/' || linked_admin_id
        and admin_doc.payload->>'role' = 'admin'
        and lower(coalesce(admin_doc.payload->>'isActive', 'true')) <> 'false'
        and coalesce(nullif(admin_doc.payload->>'churchId', ''), church_value) = church_value
    ) then
      recipient_ids := pg_catalog.array_append(recipient_ids, linked_admin_id);
    end if;

    if pg_catalog.cardinality(recipient_ids) = 0 then
      for recipient_id in
        select distinct invite_doc.payload->>'createdBy'
        from public.sat_documents invite_doc
        join public.sat_documents admin_doc
          on admin_doc.document_path = 'users/' || (invite_doc.payload->>'createdBy')
        where invite_doc.collection_path = 'adminInvites'
          and invite_doc.payload->>'invitedUserId' = requester_id
          and invite_doc.payload->>'status' = 'accepted'
          and invite_doc.payload->>'churchId' = church_value
          and admin_doc.payload->>'role' = 'admin'
          and lower(coalesce(admin_doc.payload->>'isActive', 'true')) <> 'false'
        order by invite_doc.payload->>'createdBy'
        limit 300
      loop
        recipient_ids := pg_catalog.array_append(recipient_ids, recipient_id);
      end loop;
    end if;
  end if;

  if pg_catalog.cardinality(recipient_ids) = 0 then
    for recipient_id in
      select d.document_id
      from public.sat_documents d
      where d.collection_path = 'users'
        and d.payload->>'churchId' = church_value
        and d.payload->>'role' = 'admin'
        and lower(coalesce(d.payload->>'isActive', 'true')) <> 'false'
      order by d.document_id
      limit 300
    loop
      recipient_ids := pg_catalog.array_append(recipient_ids, recipient_id);
    end loop;
  end if;

  foreach recipient_id in array recipient_ids
  loop
    insert into public.sat_documents (
      document_path, collection_path, document_id, church_id, payload,
      source_created_at, source_updated_at, source_checksum, migrated_at, created_at, updated_at
    ) values (
      'churches/' || church_value || '/notifications/memberDeletionRequest_' || new.document_id || '_' || recipient_id,
      'churches/' || church_value || '/notifications',
      'memberDeletionRequest_' || new.document_id || '_' || recipient_id,
      church_value,
      pg_catalog.jsonb_build_object(
        'leaderId', coalesce(requester_id, 'system'),
        'leaderName', requester_name,
        'adminId', recipient_id,
        'activityType', 'member_deletion_requested',
        'timestamp', now_text,
        'isRead', false,
        'churchId', church_value,
        'details', pg_catalog.jsonb_build_object('memberName', member_name, 'description', description_text),
        'metadata', pg_catalog.jsonb_build_object(
          'action', 'requested',
          'reason', nullif(reason_text, ''),
          'deletionRequestId', new.document_id,
          'memberId', new.payload->>'memberId',
          'target', coalesce(new.payload->>'target', 'member')
        )
      ),
      now_value, now_value, null, now_value, now_value, now_value
    )
    on conflict (document_path) do nothing;
  end loop;

  update public.sat_documents
  set payload = payload
        || pg_catalog.jsonb_build_object(
          'notificationCreatedAt', now_text,
          'notificationRecipientCount', pg_catalog.cardinality(recipient_ids)
        ),
      source_checksum = null,
      updated_at = now_value
  where document_path = new.document_path;

  return new;
end;
$$;

revoke all on function sat_private.create_deletion_request_notifications() from public, anon, authenticated;

drop trigger if exists sat_deletion_request_notifications on public.sat_documents;
create trigger sat_deletion_request_notifications
after insert on public.sat_documents
for each row
when (new.collection_path ~ '^churches/[^/]+/memberDeletionRequests$')
execute function sat_private.create_deletion_request_notifications();

comment on function sat_private.create_deletion_request_notifications() is
  'Creates tenant-scoped in-app notifications for new deletion requests; Firebase fallback continues external email and FCM delivery.';

notify pgrst, 'reload schema';
