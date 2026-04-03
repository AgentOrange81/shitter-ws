# Shitter.io WebSocket Server - Deployment Guide 🚀

## Repository
**GitHub:** https://github.com/AgentOrange81/shitter-ws

## Quick Deploy to Railway

### Option A: Railway Dashboard (Recommended)
1. Go to https://railway.app
2. Click "New Project" → "Deploy from GitHub repo"
3. Select `AgentOrange81/shitter-ws`
4. Railway auto-detects Dockerfile and deploys

### Option B: Railway CLI
```bash
npm install -g @railway/cli
railway login
cd ~/shitter-ws
railway init  # Select existing project or create new
railway up
```

## Environment Variables

Set these in Railway dashboard (Variables tab):

| Variable | Value | Required |
|----------|-------|----------|
| `PORT` | (auto-set by Railway) | ✅ |
| `REDIS_URL` | `redis://your-redis-host:6379` | Optional (for pub/sub scaling) |
| `CORS_ORIGIN` | `https://shitter.io` | ✅ |
| `NODE_ENV` | `production` | ✅ |
| `JWT_SECRET` | Your JWT secret key | ✅ |

## Frontend Integration

Update Shitter.io frontend env/config:

```typescript
// .env.local or config
NEXT_PUBLIC_WS_URL=wss://your-app.railway.app

// WebSocket client connection
import io from 'socket.io-client';
const socket = io(process.env.NEXT_PUBLIC_WS_URL || 'wss://your-app.railway.app', {
  transports: ['websocket'],
  auth: { token: userJwtToken }
});
```

## Health Check

Endpoint: `GET /health`
Response: `{"status": "ok", "timestamp": "..."}`

Railway healthcheck configured at `/health` with 100s timeout.

## Testing

1. Deploy to Railway
2. Get your Railway URL (e.g., `wss://shitter-ws-production.up.railway.app`)
3. Test connection:
```javascript
const socket = io('wss://your-app.railway.app', {
  transports: ['websocket'],
  auth: { token: 'your-jwt-token' }
});

socket.on('connect', () => console.log('✅ Connected!'));
socket.on('disconnect', (reason) => console.log('Disconnected:', reason));
```

4. Verify real-time notifications work on https://shitter.io

## Monitoring

- Railway Dashboard → Project → Activity logs
- Check for WebSocket connections in logs
- Monitor Redis connections if using pub/sub

## Troubleshooting

**Connection fails:**
- Check CORS_ORIGIN matches your frontend domain
- Verify JWT_SECRET is set
- Ensure PORT is not hardcoded (uses env var)

**Redis errors:**
- Add REDIS_URL env var or remove Redis from server.ts for single-instance

---

**Built:** 2026-04-02
**Stack:** Node.js + Socket.IO + Redis (optional)
**Deploy Target:** Railway.app
