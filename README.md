# US - Our Universe (Etapa 3 — fundação local, segurança e arquitetura modular)

## Estrutura

- `index.html`: casca da aplicação (HTML semântico, sem código inline).
- `styles/`: tokens de tema, base, componentes e responsividade.
- `src/core/`: constantes, utilitários, validação, persistência, store, tema, rotas e ações.
- `src/ui/`: layout, modal e toast.
- `src/features/`: uma pasta lógica por página do aplicativo.
- `sw.js`: Service Worker com precache de todos os arquivos da aplicação.
- `manifest.webmanifest` e `icons/`: metadados e ícones PWA.

Não há dependências externas, build, CDN ou etapa de compilação. Os módulos usam ES Modules nativos.

## Rotas

A navegação usa hash (`#home`, `#calendar`, `#memories`, ...). Isso permite:

- recarregar a página mantendo a seção atual;
- usar o botão voltar do navegador;
- abrir links diretos para uma seção.

## Dados

A chave `localStorage` continua sendo `us`. Nenhuma chave antiga foi removida.

O estado agora possui `schemaVersion: 1`. Ao carregar ou importar um backup, todos os registros são validados e normalizados:

- cada registro recebe `id`, `createdAt` e `updatedAt`;
- datas passam a ser ISO (`yyyy-mm-dd`), com compatibilidade com o formato antigo `dd/mm/yyyy`;
- imagens aceitas apenas como data URL de imagem conhecida e dentro de um limite;
- links aceitos apenas com `http://` ou `https://`;
- textos são limitados e escapados antes de ir para a interface.

Se o navegador recusar a escrita por falta de espaço, a alteração é revertida e um aviso é exibido, sem falso "salvo".

Quando o aplicativo está aberto em mais de uma aba do mesmo navegador, as alterações são refletidas automaticamente nas outras abas, incluindo apagar dados e trocar o tema.

## Publicação no GitHub Pages

1. Envie todos os arquivos deste projeto para a raiz do repositório, preservando as pastas `styles`, `src` e `icons`.
2. Em Settings > Pages, mantenha Deploy from a branch e `main` / `(root)`.
3. Aguarde a publicação e abra o endereço do GitHub Pages.

## Atualização do aplicativo instalado

O cache do Service Worker foi atualizado para `us-v8`. Feche e reabra o aplicativo instalado após a publicação. Se a versão antiga continuar aparecendo, feche as abas do site e abra novamente com internet.

## Observação sobre sincronização

Esta versão continua local-first: os dados são salvos no navegador/aparelho atual. O backup pode ser exportado e importado manualmente. Ainda não há backend, autenticação ou sincronização automática entre dispositivos.
