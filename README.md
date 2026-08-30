# Controle de Gastos

## Setup local
1. `npm install`
2. Copie `.env.local.example` para um novo arquivo `.env.local` (não edite o `.example`) e preencha com as credenciais do seu projeto Supabase.
3. Rode a migração `supabase/migrations/0001_init.sql` no SQL Editor do Supabase.
4. Crie seu usuário em Supabase → Authentication → Users. Se a confirmação de e-mail estiver habilitada, desative "Confirm email" em Authentication → Providers ou confirme o usuário manualmente — este app é single-user e não tem fluxo de envio de e-mail.
5. `npm run test` para rodar a suíte de testes.
6. `npm run dev`

## Deploy (Vercel)
1. Importe o repositório na Vercel.
2. Em Project Settings → Environment Variables, adicione `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` com os mesmos valores do `.env.local`.
3. Deploy.
