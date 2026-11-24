-- Draft: workspace snapshots only. Guided progress and rewards remain server-authoritative.
begin;

create table if not exists public.filet_workspace_sync (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 0 check (revision >= 0),
  workspace jsonb
);

create table if not exists public.filet_workspace_sync_receipts (
  user_id uuid not null references public.filet_workspace_sync(user_id) on delete cascade,
  operation_id uuid not null,
  request_hash bytea not null,
  revision bigint not null,
  primary key (user_id, operation_id)
);

alter table public.filet_workspace_sync enable row level security;
alter table public.filet_workspace_sync_receipts enable row level security;
revoke all on public.filet_workspace_sync, public.filet_workspace_sync_receipts
  from public, anon, authenticated, service_role;
grant select on public.filet_workspace_sync to authenticated;
drop policy if exists filet_workspace_read_owner on public.filet_workspace_sync;
create policy filet_workspace_read_owner on public.filet_workspace_sync
  for select to authenticated using (user_id = auth.uid());

create or replace function public.save_filet_workspace_v1(
  p_user_id uuid, p_operation_id uuid, p_base_revision bigint, p_workspace jsonb
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  current_revision bigint;
  fingerprint bytea;
  receipt public.filet_workspace_sync_receipts%rowtype;
begin
  if p_user_id is null or p_operation_id is null or p_base_revision is null
    or p_base_revision < 0 or p_workspace is null
    or jsonb_typeof(p_workspace) is distinct from 'object'
    or octet_length(p_workspace::text) > 5242880
  then
    raise exception 'Invalid workspace operation' using errcode = '22023';
  end if;

  fingerprint := sha256(convert_to(p_base_revision::text || ':' || p_workspace::text, 'UTF8'));
  insert into public.filet_workspace_sync(user_id) values (p_user_id)
    on conflict (user_id) do nothing;
  select revision into strict current_revision from public.filet_workspace_sync
    where user_id = p_user_id for update;

  select * into receipt from public.filet_workspace_sync_receipts
    where user_id = p_user_id and operation_id = p_operation_id;
  if found then
    if receipt.request_hash <> fingerprint then
      raise exception 'Operation ID reused with different content' using errcode = '22023';
    end if;
    return jsonb_build_object('status', 'replayed', 'revision', receipt.revision);
  end if;

  if p_base_revision <> current_revision then
    return jsonb_build_object('status', 'conflict', 'revision', current_revision);
  end if;

  current_revision := current_revision + 1;
  update public.filet_workspace_sync set revision = current_revision, workspace = p_workspace
    where user_id = p_user_id;
  insert into public.filet_workspace_sync_receipts(user_id, operation_id, request_hash, revision)
    values (p_user_id, p_operation_id, fingerprint, current_revision);
  return jsonb_build_object('status', 'applied', 'revision', current_revision);
end
$$;

revoke all on function public.save_filet_workspace_v1(uuid, uuid, bigint, jsonb)
  from public, anon, authenticated;
grant execute on function public.save_filet_workspace_v1(uuid, uuid, bigint, jsonb) to service_role;

commit;
