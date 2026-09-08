-- Execute somente depois de criar o primeiro usuário pelo Supabase Auth.
-- Troque o e-mail abaixo pelo e-mail administrativo real.

update public.profiles
set role = 'admin',
    active = true,
    updated_at = now()
where lower(email) = lower('ADMIN_EMAIL_AQUI');
