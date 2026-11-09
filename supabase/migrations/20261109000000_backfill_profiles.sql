-- People who signed up before the schema existed have no profile, because the sign-up trigger was
-- not there yet; food needs, groups and picks all hang off a profile. This gives them one.
insert into public.profiles (id, name)
select u.id, coalesce(nullif(trim(u.raw_user_meta_data ->> 'name'), ''), split_part(u.email, '@', 1))
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);
