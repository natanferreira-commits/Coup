# Como rodar o GOLPE localmente

## 1. Servidor

```bash
cd golpe/server
npm install
npm run dev
```

Servidor sobe em http://localhost:3001

## 2. Cliente

```bash
cd golpe/client
npm install
npm run dev
```

Cliente sobe em http://localhost:5173

## Para jogar com amigos localmente (na mesma rede)

1. Descubra seu IP local: `ipconfig` no terminal (Windows) → IPv4 Address
2. Crie um arquivo `golpe/client/.env` com:
   ```
   VITE_SERVER_URL=http://SEU_IP:3001
   ```
3. Compartilhe http://SEU_IP:5173 com os amigos na mesma rede

## Para hospedar online (Railway + Vercel)

### Servidor no Railway
1. Crie conta em railway.app
2. New Project → Deploy from GitHub → selecione a pasta `server`
3. Adicione variável: PORT=3001
4. Copie a URL gerada (ex: https://golpe-server.up.railway.app)

### Cliente no Vercel
1. Crie conta em vercel.com
2. Import do GitHub → selecione a pasta `client`
3. Adicione variável de ambiente: VITE_SERVER_URL=https://sua-url-railway.app
4. Deploy!
