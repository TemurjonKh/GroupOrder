-- Each person can heart dishes. Hearted dishes come first on menus and on the lunch page.
-- A favourite is private: nobody else can see, add or remove it.

create table public.favourite_dishes (
  user_id uuid not null references public.profiles on delete cascade,
  menu_item_id uuid not null references public.menu_items on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, menu_item_id)
);
alter table public.favourite_dishes enable row level security;
revoke all on public.favourite_dishes from anon, authenticated;
grant select on public.favourite_dishes to authenticated;
create policy "people read their own favourites" on public.favourite_dishes for select to authenticated
  using (user_id = auth.uid());

-- Hearts the dish, or takes the heart off if it is already there. Returns whether it is now a favourite.
create function public.toggle_favourite(p_menu_item uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  delete from public.favourite_dishes where user_id = auth.uid() and menu_item_id = p_menu_item;
  if found then return false; end if;
  if not exists (select 1 from public.menu_items where id = p_menu_item) then raise exception 'unknown_dish'; end if;
  insert into public.favourite_dishes (user_id, menu_item_id) values (auth.uid(), p_menu_item);
  return true;
end;
$$;
revoke execute on function public.toggle_favourite(uuid) from public, anon;
grant execute on function public.toggle_favourite(uuid) to authenticated;
