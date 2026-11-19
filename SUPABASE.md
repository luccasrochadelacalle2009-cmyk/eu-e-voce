# Configuração do Supabase — US (Etapa 5)

## 1. Autenticação

- **Authentication → Providers → Email**: habilitado, com **Confirm email DESLIGADO**.
  - Assim o cadastro entra direto no app e não consome o limite de 2 e-mails/hora do SMTP padrão.
  - Recuperação de senha só funcionará se você configurar um SMTP próprio em **Authentication → Settings → SMTP Settings**.
- **Authentication → URL Configuration**:
  - Site URL: `https://luccasrochadelacalle2009-cmyk.github.io/eu-e-voce/`
  - Redirect URLs: a mesma URL, `.../**`, `http://localhost:4173/`, `http://localhost:4173/**`.
- URL e anon/public key: `src/core/config.js`. Nunca use `service_role` no site.

## 2. Banco de dados — ordem dos scripts

O projeto já tem o bootstrap de casais aplicado. Para esta etapa:

Rode os três blocos em abas novas, nesta ordem:

1. `supabase/etapa5a.sql` — estrutura (colunas de status, `user_settings` e RLS).
2. `supabase/etapa5b.sql` — funções de vínculo e RPCs de convite.
3. `supabase/etapa5c.sql` — confirmação, desconexão, políticas, Realtime e grants.

Para cada um: **SQL Editor → New query**, copie o arquivo inteiro (`Ctrl+A`, `Ctrl+C`), cole e **Run**. Se aparecer o aviso amarelo de “potential issues”, confirme — o RLS está no script. Confira se terminou sem erro vermelho antes de ir para o próximo. No fim, dê **Ctrl+F5** no app.

O arquivo `supabase/etapa5.sql` continua disponível como versão única, mas os blocos divididos evitam cortes na colagem do SQL Editor.

Para uma instalação nova do zero, rode apenas `supabase/schema.sql` — ele já contém tudo da Etapa 5. O `bootstrap-couples.sql` é apenas um caminho alternativo de destravamento.

## 3. Conectar duas contas (fluxo real)

1. Cada pessoa cria sua conta nas duas abas/origens:
   - `http://localhost:4173/#home`
   - `http://127.0.0.1:4173/#home`
2. A pessoa A abre **Configurações → Nuvem e conexão do casal** e clica em **Criar casal e gerar convite**.
3. A recebe um código de 6 caracteres e um **link de convite**. Copia o link e envia para B.
4. B abre o link: o código já vem preenchido. B clica em **Aceitar convite**.
5. B aparece como pendente e **não compartilha dados ainda**.
6. A vê o pedido e clica em **Confirmar conexão** (ou **Recusar convite**).
7. Só então o status muda para **Conectados** e a sincronização começa.

Se o link não funcionar, B pode digitar o código manualmente. O dono pode **Gerar novo código** a qualquer momento.

## 4. Desconexão

**Desconectar esta conta** revoga o vínculo no banco na hora. A outra pessoa perde o acesso aos dados compartilhados imediatamente. Os dados locais (`us`) e o histórico no banco não são apagados. Para voltar a compartilhar, é preciso um novo convite.

## 5. Dados individuais e compartilhados

| Tipo | Onde fica | Exemplos |
|---|---|---|
| Individual | `user_settings` + `us` | tema, preferências, campos privados |
| Compartilhado | tabelas de conteúdo + `couple_settings` | memórias, cartas, planos, agenda, diário, lugares, respostas, desafios, nomes e data de início |

Cada conteúdo compartilhado exibe **Por Nome · editado por Nome**. O nome vem de `profiles`.

## 6. Permissões e RLS

- `is_couple_member` exige vínculo **ativo** e casal **ativo** — é a base do acesso ao conteúdo.
- `is_partner` exige que os dois estejam ativos no mesmo casal.
- `is_invited_by` permite que uma conta pendente veja apenas quem a convidou.
- `is_couple_member_any` serve somente para ler os dados básicos do casal e do convite.
- Escrita em conteúdo exige `updated_by = auth.uid()`, conferido no banco.
- `user_settings` só é legível/escrevível pelo próprio `user_id`.
- Nenhuma conta lê dados de outro casal.

## 7. Sincronização

- Fila em `us.cloud.ops`, separada da chave `us`.
- Push com `upsert` por `(couple_id, legacy_id)`; exclusões viram `deleted_at`.
- Pull ao abrir, ao reconectar, manual e em tempo real via Realtime.
- Preferências pessoais sincronizam mesmo sem casal ativo.
- Conflitos usam last-write-wins por timestamp, desempate determinístico e auditoria em `sync_conflicts`.

## 8. Publicação

1. Envie todo o projeto, incluindo `vendor/`, `supabase/`, `src/` e `styles/`.
2. Confira Site URL e Redirect URLs.
3. O Service Worker é `us-v11`: feche e reabra o app instalado para atualizar o cache.
