# Shitter WebSocket Server

Real-time WebSocket server for Shitter.io using Socket.IO and Redis Pub/Sub.

## Architecture

```
Browser (Next.js on Vercel) ←WS→ WebSocket Server (Railway/Fly)
                                       ↓
                                  Redis Pub/Sub
```

## Features

- **Authentication**: JWT-based auth with short-lived tokens
- **Events**:
  - `auth` - Client authentication
  - `subscribe:notifications` - Real-time notifications
  - `subscribe:feed` - Live feed updates
  - `subscribe:mints` - New token mint alerts
  - `tip:send` - Send tip notifications
  - `presence:online/offline` - User presence tracking
- **Redis Pub/Sub**: Horizontal scaling support
- **Auto-reconnect**: Exponential backoff on client side

## Local Development

### Prerequisites

- Node.js 20+
- Redis (local or cloud)

### Setup

1. Install dependencies:
```bash
npm install
```

2. Copy environment file:
```bash
cp .env.example .env
```

3. Update `.env` with your Redis URL:
```
REDIS_URL=redis://localhost:6379
WS_JWT_SECRET=your-secret-key
```

4. Start Redis (if local):
```bash
redis-server
```

5. Run development server:
```bash
npm run dev
```

Server runs on `http://localhost:4000`

### Health Check

```bash
curl http://localhost:4000/health
```

## Deployment (Railway)

1. Push code to GitHub repo

2. Create new Railway project:
```bash
railway init
```

3. Add Redis service:
```bash
railway add redis
```

4. Deploy WebSocket server:
```bash
railway up
```

5. Set environment variables:
```bash
railway variables set \
  REDIS_URL=<redis-connection-string> \
  WS_JWT_SECRET=<your-production-secret> \
  ALLOWED_ORIGINS=https://shitter.io
```

6. Get deployment URL and update main app's `NEXT_PUBLIC_WS_URL`

## Deployment (Fly.io)

1. Initialize Fly app:
```bash
fly launch --name shitter-ws
```

2. Use `fly.toml` config (included in repo)

3. Deploy:
```bash
fly deploy
```

4. Add Redis (Upstash or Fly Redis):
```bash
fly redis create
```

5. Set secrets:
```bash
fly secrets set \
  REDIS_URL=<redis-url> \
  WS_JWT_SECRET=<secret> \
  ALLOWED_ORIGINS=https://shitter.io
```

## Client Integration

The Next.js app includes:
- `src/lib/websocket.ts` - WebSocket singleton client
- `src/hooks/useWebSocket.ts` - React hook for WS
- `src/app/api/ws/auth/route.ts` - Auth token endpoint

Update `.env.local` in main app:
```
NEXT_PUBLIC_WS_URL=ws://localhost:4000  # Local
WS_URL=wss://shitter-ws.railway.app     # Production
```

## Testing

1. Start both servers:
```bash
# Terminal 1 - WebSocket server
cd ~/shitter-ws && npm run dev

# Terminal 2 - Next.js app
cd ~/shitter && npm run dev
```

2. Open browser to `http://localhost:3000`
3. Check browser console for WebSocket connection logs
4. Test real-time features (notifications, mints, etc.)

## Troubleshooting

**Connection fails:**
- Check Redis is running
- Verify CORS origins match
- Check firewall allows port 4000

**Auth errors:**
- Ensure `WS_JWT_SECRET` matches between servers
- Token expires after 1 hour (by design)

**Redis connection issues:**
- Use `redis-cli ping` to test connectivity
- Check Redis URL format
