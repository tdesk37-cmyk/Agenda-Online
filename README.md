# Agenda online – Unhas de Gel

Site estático (GitHub Pages) + Google Planilhas como banco de dados (via Apps Script).

- `index.html` – página onde a cliente agenda
- `admin.html` – painel com senha para ver, concluir, cancelar e bloquear horários
- `config.js` – URL da API, nome do salão e WhatsApp
- `apps-script/Code.gs` – backend (vai no Apps Script, **não** precisa subir no GitHub)

## 1. Planilha e Apps Script

1. Crie uma planilha nova no Google Planilhas.
2. Menu **Extensões > Apps Script**, apague o conteúdo e cole o `Code.gs`.
3. Ajuste o bloco `CONFIG` (serviços, preços, durações, dias e horário de funcionamento, almoço, folgas).
4. Selecione a função `setup` e clique em **Executar** (autorize o acesso).
5. **Configurações do projeto** (ícone de engrenagem) > **Propriedades do script** > adicionar:
   `ADMIN_SENHA` = a senha do painel.
6. **Implantar > Nova implantação** > tipo **App da Web**
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa**
7. Copie a URL que termina em `/exec`.

> Sempre que alterar o `Code.gs`: **Implantar > Gerenciar implantações > editar (lápis) > Versão: Nova versão**. Assim a URL continua a mesma.

## 2. Site no GitHub Pages

1. No `config.js`, cole a URL em `API_URL` e coloque o WhatsApp do salão (`55` + DDD + número).
2. Crie um repositório (ex.: `agenda-unhas-de-gel`) e suba `index.html`, `admin.html`, `style.css` e `config.js`.
3. No repositório: **Settings > Pages > Source: Deploy from a branch > main / (root)**.
4. Em 1–2 minutos o site fica em `https://SEU-USUARIO.github.io/agenda-unhas-de-gel/`
   - Clientes: `.../agenda-unhas-de-gel/`
   - Painel: `.../agenda-unhas-de-gel/admin.html`

## Observações

- A agenda considera **uma profissional** (um atendimento por vez).
- A planilha também pode ser aberta direto para consulta ou ajustes manuais.
- Status possíveis: confirmado, concluido, cancelado, faltou, bloqueado. Cancelado libera o horário.
