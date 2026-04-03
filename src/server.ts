import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { createClient } from 'redis';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 4000;
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const WS_JWT_SECRET = process.env.WS_JWT_SECRET || 'dev-secret-change-in-production';

// Redis client for pub/sub
let redisPub: any = null;
let redisSub: any = null;

async function initRedis() {
  try {
    redisPub = createClient({ url: REDIS_URL });
    redisSub = createClient({ url: REDIS_URL });
    
    redisSub.on('message', (channel: string, message: string) => {
      // Broadcast to subscribed sockets
      io.to(channel).emit(channel, JSON.parse(message));
    });

    await redisPub.connect();
    await redisSub.connect();
    await redisSub.subscribe('notifications', 'feed', 'mints');
    
    console.log('✅ Redis connected');
  } catch (error) {
    console.error('❌ Redis connection failed:', error);
  }
}

// HTTP server
const httpServer = createServer((req, res) => {
  // Simple health check
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', connections: io.engine.clientsCount }));
    return;
  }
  
  res.writeHead(404);
  res.end('Not found');
});

// Socket.IO server with CORS
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'https://shitter.io'],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// User presence tracking
const userSockets = new Map<string, Set<string>>(); // userId -> Set<socketId>

io.use(async (socket, next) => {
  // Auth middleware
  const token = socket.handshake.auth.token || socket.handshake.query.token as string;
  
  if (!token) {
    return next(new Error('Authentication required'));
  }
  
  try {
    const decoded = jwt.verify(token, WS_JWT_SECRET) as { userId: string; username: string };
    socket.data.userId = decoded.userId;
    socket.data.username = decoded.username;
    next();
  } catch (error) {
    next(new Error('Invalid authentication token'));
  }
});

io.on('connection', (socket) => {
  const userId = socket.data.userId;
  const username = socket.data.username;
  
  console.log(`🔌 User connected: ${username} (${userId})`);
  
  // Track user presence
  if (!userSockets.has(userId)) {
    userSockets.set(userId, new Set());
  }
  userSockets.get(userId)!.add(socket.id);
  
  // Broadcast online presence
  socket.to('presence').emit('presence:online', { userId, username });
  
  // Join presence room
  socket.join('presence');
  
  // Handle auth event (for re-authentication)
  socket.on('auth', (data: { token: string }) => {
    try {
      const decoded = jwt.verify(data.token, WS_JWT_SECRET) as { userId: string; username: string };
      socket.data.userId = decoded.userId;
      socket.data.username = decoded.username;
      socket.emit('auth:success', { userId: decoded.userId, username: decoded.username });
    } catch (error) {
      socket.emit('auth:error', { message: 'Invalid token' });
    }
  });
  
  // Subscribe to notifications
  socket.on('subscribe:notifications', () => {
    socket.join(`notifications:${userId}`);
    console.log(`📬 ${username} subscribed to notifications`);
  });
  
  // Subscribe to feed updates
  socket.on('subscribe:feed', () => {
    socket.join('feed:global');
    console.log(`📰 ${username} subscribed to feed`);
  });
  
  // Subscribe to mint events
  socket.on('subscribe:mints', () => {
    socket.join('mints:live');
    console.log(`🪙 ${username} subscribed to mints`);
  });
  
  // Send tip notification
  socket.on('tip:send', async (data: { recipientId: string; amount: number; senderId: string }) => {
    const { recipientId, amount, senderId } = data;
    
    // Publish to Redis for persistence/scaling
    if (redisPub) {
      await redisPub.publish(
        `notifications:${recipientId}`,
        JSON.stringify({
          type: 'tip:received',
          data: { recipientId, amount, senderId, timestamp: Date.now() }
        })
      );
    }
    
    // Emit directly to recipient
    io.to(`notifications:${recipientId}`).emit('notification', {
      type: 'tip:received',
      data: { amount, senderId, timestamp: Date.now() }
    });
    
    console.log(`💸 Tip sent: ${senderId} → ${recipientId} (${amount})`);
  });
  
  // Handle disconnection
  socket.on('disconnect', async () => {
    console.log(`❌ User disconnected: ${username} (${userId})`);
    
    // Remove socket from user tracking
    const userSocketSet = userSockets.get(userId);
    if (userSocketSet) {
      userSocketSet.delete(socket.id);
      
      // If no more sockets for this user, broadcast offline
      if (userSocketSet.size === 0) {
        userSockets.delete(userId);
        socket.to('presence').emit('presence:offline', { userId, username });
      }
    }
  });
});

// External API for publishing events (from main app)
export function publishEvent(channel: string, data: any) {
  if (redisPub) {
    redisPub.publish(channel, JSON.stringify(data));
  }
  io.to(channel).emit(channel, data);
}

// Start server
async function start() {
  await initRedis();
  
  httpServer.listen(PORT, () => {
    console.log(`🚀 WebSocket server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
  });
}

start().catch(console.error);
