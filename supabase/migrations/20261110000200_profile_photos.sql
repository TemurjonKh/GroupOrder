-- Profile photos are stored with the profile as a small image (resized to 256 px in the browser,
-- about 20 KB), so they work the same locally and on Supabase without a storage bucket.
-- Only an https link or a JPEG, PNG or WebP image of up to about 150 KB is accepted.
alter table public.profiles add constraint profiles_avatar_check check (
  avatar is null
  or (char_length(avatar) <= 200000
      and (avatar like 'https://%' or avatar ~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$'))
);
