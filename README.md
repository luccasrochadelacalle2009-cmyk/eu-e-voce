# US — Our Universe (Etapa 5 — conexão e compartilhamento)

PWA local-first com contas Supabase, PostgreSQL, convite confirmado entre duas contas, espaço privado do casal, dados pessoais separados e sincronização real bidirecional. A chave `us` nunca é apagada.

## Arquitetura

- `index.html`: casca, CSP com o host exato do Supabase.
- `styles/`: base, temas, componentes (indicadores de conexão e sincronização) e responsividade.
- `src/core/`: store, storage, auth, cliente Supabase, `cloud.js` (banco/RPC), `sync.js` (fila, pull, realtime, conflitos) e migração.
- `src/features/cloud.js`: interface de casal, convite, conexão e migração.
- `src/ui/author.js`: rodapé de autoria em cada conteúdo compartilhado.
- `vendor/supabase-js.js`: SDK oficial local, sem CDN e sem build.
- `supabase/schema.sql`: DDL completo (instalação nova).
- `supabase/bootstrap-couples.sql`: DDL mínimo de casais (destravamento).
- `supabase/etapa5a.sql`, `etapa5b.sql`, `etapa5c.sql`: migração incremental da Etapa 5 em blocos pequenos (há também a versão única `etapa5.sql`).
- `SUPABASE.md`: configuração passo a passo.
- `sw.js`: Service Worker `us-v11`.

## Banco de dados

| Tabela | Finalidade | Escopo |
|---|---|---|
| `profiles` | nome público de cada conta | individual + visível ao parceiro |
| `user_settings` | tema, preferências e campos privados | **somente da conta** |
| `couples` | nome, data, código de convite e estado da conexão | casal |
| `couple_members` | vínculo, papel (`owner`/`partner`) e status (`pending`/`active`) | casal |
| `couple_settings` | nomes e data de início compartilhados | casal |
| `memories`, `calendar_events`, `plans`, `letters`, `journal`, `music`, `places`, `answers`, `challenges` | conteúdo do casal, com `created_by`, `updated_by`, `updated_at` e `deleted_at` | casal |
| `sync_conflicts` | versões perdedoras de conflitos | casal |

Todas têm RLS. O frontend usa apenas a anon/public key. Nada de `service_role` no código.

## Conexão entre duas contas

1. A pessoa A cria o casal e recebe um **código de 6 caracteres** e um **link de convite**.
2. A pessoa B abre o link (o código já vem preenchido) e aceita o convite.
3. B fica como **pendente**. Nenhum dado é compartilhado nesse momento.
4. A vê o pedido e clica em **Confirmar conexão** (ou recusa).
5. Só depois da confirmação as duas contas passam a ler e gravar o mesmo conteúdo.

O dono pode **gerar um novo código** e **desconectar a conta**. A desconexão revoga o acesso imediatamente; os dados locais do aparelho não são apagados e o histórico no banco permanece para auditoria.

## Dados individuais × compartilhados

- **Individuais** (`user_settings`): tema, `profile1`, `profile2`, configurações da conta. Cada pessoa altera sem afetar a outra.
- **Do casal** (tabelas de conteúdo + `couple_settings`): memórias, cartas, planos, agenda, desafios, diário, lugares, respostas, nomes e data de início.

Cada registro compartilhado mostra **quem criou** e, quando diferente, **quem editou por último**.

## Permissões

| Ação | Dados individuais | Dados do casal |
|---|---|---|
| Visualizar | só a própria conta | qualquer membro **ativo** |
| Criar | só a própria conta | qualquer membro **ativo** |
| Editar | só a própria conta | qualquer membro **ativo** |
| Excluir | só a própria conta | qualquer membro **ativo** (tombstone) |

O vínculo é validado no banco pelas funções `is_couple_member`, `is_partner` e `is_invited_by` (todas `security definer`). Um convite pendente não consegue ler nem escrever conteúdo compartilhado. Uma conta nunca acessa dados de outro casal.

## Sincronização

- Fila persistida em `us.cloud`, separada de `us`.
- `upsert` por `(couple_id, legacy_id)` evita duplicação.
- Pull ao abrir, ao reconectar, manual e via Realtime (`postgres_changes`).
- Exclusões usam `deleted_at`.
- Conflitos: last-write-wins por `updated_at`, desempate determinístico e versão perdedora registrada em `sync_conflicts`.
- Tema e preferências pessoais sincronizam mesmo sem casal ativo.

## Migração

**Validar dados locais** mostra quantos registros serão enviados. **Migrar este aparelho** envia tudo com `legacy_id` estável. A chave `us` não é alterada e repetir a migração não duplica registros. `challenges` (array de datas) é tratado como um registro por data.

## Segurança

- RLS conferida no banco, não só no JavaScript.
- Escritas compartilhadas exigem `updated_by = auth.uid()`.
- O código só pode ser usado por uma segunda conta e nunca conecta ninguém automaticamente.
- CSP restringe conexões ao host exato do projeto.
- O Service Worker ignora requisições cross-origin.
- Sessão em `us.auth`; senhas nunca são salvas.

## Testes

Estáticos: sintaxe de todos os módulos, 41 arquivos no precache, carregamento sem erro no console, formulários de conta.

Os testes reais com duas contas (convite, aceite, confirmação, compartilhamento, autoria, permissões e desconexão) são registrados em `SUPABASE.md` ao final da etapa.
