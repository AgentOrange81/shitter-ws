# WebSocket Server Deployment Guide

## Quick Start (Local Testing)

### 1. Start Redis
```bash
# Local Redis
redis-server

# Or use Docker
docker run -d -p 6379:6379 redis:alpine
```

### 2. Start WebSocket Server
```bash
cd ~/shitter-ws
npm install
npm run dev
```

Server runs on `http://localhost:4000`

### 3. Start Next.js App
```bash
cd ~/shitter
npm run dev
```

App runs on `http://localhost:3000`

### 4. Test Connection
Open browser to `http://localhost:3000` and check console for:
- `🔌 Connecting to WebSocket: ws://localhost:4000`
- `✅ WebSocket connected`

Health check:
```bash
curl http://localhost:4000/health
# Returns: {"status":"ok","connections":0}
```

---

## Production Deployment (Railway)

### Prerequisites
- Railway account (`railway app` installed)
- GitHub repo with code
- Redis instance (Railway Redis or Upstash)

### Step 1: Push Code to GitHub
```bash
cd ~/shitter-ws
git init
git add .
git commit -m "Initial WebSocket server"
git remote add origin https://github.com/youruser/shitter-ws.git
git push -u origin main
```

### Step 2: Create Railway Project
```bash
cd ~/shitter-ws
railway login
railway init --name shitter-ws
```

### Step 3: Add Redis
Option A - Railway Redis:
```bash
railway add redis
```

Option B - Upstash Redis:
1. Create at https://upstash.com
2. Get connection string
3. Set as variable: `railway variables set REDIS_URL=redis://...`

### Step 4: Deploy
```bash
railway up
```

### Step 5: Configure Environment Variables
```bash
railway variables set \
  PORT=4000 \
  WS_JWT_SECRET=<generate-strong-random-secret> \
  ALLOWED_ORIGINS=https://shitter.io,https://www.shitter.io \
  REDIS_URL=<your-redis-url>
```

### Step 6: Get Deployment URL
```bash
railway domains
# Returns: shitter-ws-production.up.railway.app
```

### Step 7: Update Main App
In `~/shitter/.env.local`:
```
NEXT_PUBLIC_WS_URL=wss://shitter-ws-production.up.railway.app
WS_JWT_SECRET=<same-as-ws-server>
```

Redeploy Next.js app:
```bash
cd ~/shitter && vercel --prod
```

---

## Production Deployment (Fly.io)

### Prerequisites
- Fly.io account (`flyctl` installed)

### Step 1: Initialize Fly App
```bash
cd ~/shitter-ws
fly launch --name shitter-ws --region iad
```

### Step 2: Configure fly.toml
Create `fly.toml`:
```toml
app = "shitter-ws"
primary_region = "iad"

[build]
  dockerfile = "Dockerfile"

[http_service]
  internal_port = 4000
  force_https = true
  auto_stop_machines = false
  auto_start_machines = true
  min_machines_running = 1
  processes = ["app"]

[[vm]]
  memory = "256mb"
  cpu_kind = "shared"
  cpus = 1
```

### Step 3: Deploy
```bash
fly deploy
```

### Step 4: Add Redis
Option A - Fly Redis:
```bash
fly redis create
fly redis attach --redis-app <redis-name>
```

Option B - Upstash:
```bash
fly secrets set REDIS_URL=redis://...
```

### Step 5: Set Secrets
```bash
fly secrets set \
  WS_JWT_SECRET=<strong-secret> \
  ALLOWED_ORIGINS=https://shitter.io
```

### Step 6: Get URL
```bash
fly status
# Returns: https://shitter-ws.fly.dev
```

Update main app's `NEXT_PUBLIC_WS_URL` accordingly.

---

## Environment Variables

### WebSocket Server (.env)
| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Server port | `4000` |
| `REDIS_URL` | Redis connection | `redis://localhost:6379` |
| `WS_JWT_SECRET` | JWT signing secret | `random-string-32-chars` |
| `ALLOWED_ORIGINS` | CORS origins | `https://shitter.io` |

### Next.js App (.env.local)
| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_WS_URL` | WS server URL | `wss://shitter-ws.railway.app` |
| `WS_JWT_SECRET` | Must match WS server | `same-as-above` |

---

## Troubleshooting

### Connection Fails
1. Check Redis is running: `redis-cli ping`
2. Verify WS server health: `curl http://localhost:4000/health`
3. Check browser console for errors
4. Verify CORS origins match

### Auth Errors
- Ensure `WS_JWT_SECRET` is identical in both apps
- Tokens expire after 1 hour (by design)
- Check Next.js API route returns valid token

### Redis Issues
- Test connectivity: `redis-cli -h <host> -p <port> ping`
- For cloud Redis, ensure firewall allows connections
- Check SSL requirements (some providers need `rediss://`)

### High Latency
- Deploy WS server close to users (same region as Vercel)
- Use Redis cluster for horizontal scaling
- Monitor connection count via `/health` endpoint

---

## Monitoring

### Health Endpoint
```bash
curl https://shitter-ws.railway.app/health
# {"status":"ok","connections":15}
```

### Logs (Railway)
```bash
railway logs
```

### Logs (Fly)
```bash
fly logs -a shitter-ws
```

### Metrics to Watch
- Active connections (`/health` endpoint)
- Redis memory usage
- Reconnection frequency
- Auth failure rate

---

## Scaling

For high traffic:
1. Run multiple WS server instances behind load balancer
2. Use Redis Cluster for pub/sub across instances
3. Enable sticky sessions (Socket.IO needs them)
4. Consider dedicated Redis instance

Railway auto-scales with:
```bash
railway scale set web --min=2 --max=10
```

Fly.io scaling:
```bash
fly scale count 3 -a shitter-ws
```
