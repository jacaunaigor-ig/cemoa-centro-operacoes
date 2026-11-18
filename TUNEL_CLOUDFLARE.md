# Guia de Configuração do Cloudflare Tunnel

O `cloudflared` já está instalado nesta máquina em `C:\Program Files (x86)\cloudflared\cloudflared.exe`.

Este projeto roda por padrão na porta **`43127`** (`http://127.0.0.1:43127`).

---

## Opção 1: Túnel Rápido (Sem login / Sem domínio próprio)

Ideal para testes, demonstrações ou compartilhamento imediato de link HTTPS.

### Como rodar:

1. Em um terminal, inicie o projeto normalmente:
   ```bash
   cd cemoa-centro-operacoes
   npm run dev
   ```

2. Em outro terminal, execute:
   ```bash
   cd cemoa-centro-operacoes
   npm run tunnel
   ```
   *(Ou execute o script `iniciar-tunel.bat` na raiz do projeto)*

3. O terminal exibirá uma URL pública automática gerada pela Cloudflare no formato:
   `https://<palavras-aleatorias>.trycloudflare.com`

---

## Opção 2: Túnel Permanente com Domínio Próprio (Zero Trust)

Ideal para manter um subdomínio fixo (ex: `cemoa.seudominio.com.br`) sempre apontando para a aplicação.

### Passo 1: Criar o túnel no Cloudflare Zero Trust
1. Acesse o painel da [Cloudflare Zero Trust](https://one.dash.cloudflare.com/).
2. No menu lateral esquerdo, vá em **Networks** → **Tunnels**.
3. Clique em **Add a tunnel** (ou *Create a tunnel*).
4. Selecione o conector **Cloudflared** e dê um nome (ex: `cemoa-operacoes`).
5. Na tela seguinte ("Install and run a connector"):
   - Escolha o sistema operacional **Windows**.
   - A Cloudflare exibirá um comando com um **token**, por exemplo:
     ```cmd
     cloudflared.exe service install eyJh...
     ```

### Passo 2: Vincular o serviço no Windows
Execute o comando fornecido no PowerShell/CMD como Administrador para registrar como serviço automático do Windows:
```cmd
cloudflared.exe service install <SEU_TOKEN>
```
*(Ou execute sem instalar serviço: `cloudflared tunnel run --token <SEU_TOKEN>`)*

### Passo 3: Configurar a Rota Pública (Public Hostname)
No painel da Cloudflare (aba **Public Hostname** do túnel):
- **Subdomain**: ex: `cemoa` (ou o que preferir)
- **Domain**: selecione seu domínio registrado na Cloudflare
- **Service Type**: `HTTP`
- **URL**: `localhost:43127`

Clique em **Save tunnel**. Agora o projeto estará acessível publicamente pelo seu domínio fixo e com certificado SSL automático!
