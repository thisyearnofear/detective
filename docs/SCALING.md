# Scaling Guide for Detective

This document explains how to scale the Detective game from a single-server deployment to a horizontally-scaled production environment.

## Architecture Overview

### Single Server (Development)
```
┌─────────────────────────────────────────────────────────────┐
│                     Next.js Server                          │
│  ┌─────────────────────────────────────────────────────────┐│
│  │           GameManager (In-Memory Singleton)             ││
│  │  • players: Map<fid, Player>                            ││
│  │  • bots: Map<fid, Bot>                                  ││
│  │  • matches: Map<matchId, Match>                         ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

**Limits:** ~50-100 concurrent players, single server only

### Horizontally Scaled (Production)
```
┌─────────────────────────────────────────────────────────────┐
│                    Load Balancer                            │
└─────────────────────────┬───────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
     ┌─────────┐     ┌─────────┐     ┌─────────┐
     │ Server 1│     │ Server 2│     │ Server 3│
     └────┬────┘     └────┬────┘     └────┬────┘
          │               │               │
          └───────────────┼───────────────┘
                          ▼
                    ┌───────────┐
                    │   Redis   │ (Shared State)
                    │  Cluster  │
                    └─────┬─────┘
                          │
                    ┌─────┴─────┐
                    │ PostgreSQL│ (Persistence)
                    └───────────┘
```

**Limits:** 1000+ concurrent players, unlimited horizontal scaling

## Setup Instructions

### 1. Redis Setup (Required for Scaling)

Redis is used for:
- Real-time game state (players, matches, sessions)
- Distributed locking
- Bot response caching

#### Option A: Upstash (Recommended for Serverless)
1. Create account at [upstash.com](https://upstash.com)
2. Create a new Redis database
3. Copy the connection URL

#### Option B: Redis Cloud
1. Create account at [redis.com](https://redis.com/try-free/)
2. Create a new database
3. Copy the connection URL

#### Option C: Self-hosted
```bash
# Docker
docker run -d --name redis -p 6379:6379 redis:alpine

# Or install locally
brew install redis  # macOS
apt install redis   # Ubuntu
```

#### Configuration
```env
# .env
REDIS_URL=redis://localhost:6379
# Or for Upstash: redis://default:xxx@xxx.upstash.io:6379
USE_REDIS=true
```

### 2. PostgreSQL Setup (Required for Persistence)

PostgreSQL is used for:
- Match history
- Global leaderboards
- Player statistics

#### Option A: Neon (Recommended for Serverless)
1. Create account at [neon.tech](https://neon.tech)
2. Create a new project
3. Copy the connection URL

#### Option B: Supabase
1. Create account at [supabase.com](https://supabase.com)
2. Create a new project
3. Go to Settings > Database > Connection string

#### Option C: Self-hosted
```bash
# Docker
docker run -d --name postgres -p 5432:5432 \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=detective \
  postgres:15-alpine

# Or install locally
brew install postgresql  # macOS
apt install postgresql   # Ubuntu
```

#### Configuration
```env
# .env
DATABASE_URL=postgresql://user:password@localhost:5432/detective
USE_DATABASE=true
```

#### Initialize Tables
```bash
npm run db:setup
```

### 3. Ably Configuration

Ably is used for real-time WebSocket communication.

#### Free Tier Limits
- 200 peak connections
- 6 million messages/month

#### Scaling Considerations
The app uses two channel strategies:

1. **Per-match channels** (default for < 20 players)
   - Each match gets its own channel
   - Simple but creates many channels

2. **Shared channels** (for > 20 players)
   - 3 channels per game cycle (chat, events, presence)
   - Messages routed by targetFid
   - Much more efficient

```env
# .env
ABLY_API_KEY=your_api_key
NEXT_PUBLIC_ENABLE_WEBSOCKET=true
```

## Environment Variables

### Required for Production
```env
# API Keys
NEYNAR_API_KEY=xxx          # Farcaster user data
VENICE_API_KEY=xxx          # Bot AI responses
ABLY_API_KEY=xxx            # WebSocket

# Redis (for horizontal scaling)
REDIS_URL=redis://xxx
USE_REDIS=true

# PostgreSQL (for persistence)
DATABASE_URL=postgresql://xxx
USE_DATABASE=true

# WebSocket
NEXT_PUBLIC_ENABLE_WEBSOCKET=true
```

### Optional
```env
# Feature flags
USE_SHARED_CHANNELS=true    # Use optimized Ably channels
BOT_RESPONSE_CACHE=true     # Pre-generate bot responses
```

## Deployment Options

### Vercel (Recommended)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard
```

**Note:** Vercel's serverless functions have a 10-second timeout on the free tier. Consider upgrading for production.

### Railway
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

### Docker
```dockerfile
# Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

```bash
docker build -t detective .
docker run -p 3000:3000 --env-file .env detective
```

### Kubernetes
```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: detective
spec:
  replicas: 3
  selector:
    matchLabels:
      app: detective
  template:
    metadata:
      labels:
        app: detective
    spec:
      containers:
      - name: detective
        image: detective:latest
        ports:
        - containerPort: 3000
        envFrom:
        - secretRef:
            name: detective-secrets
```

## Performance Tuning

### Redis Optimization
```typescript
// Connection pooling is handled automatically
// Adjust these in redis.ts if needed:
maxRetriesPerRequest: 3,
retryStrategy(times) {
  return Math.min(times * 50, 2000);
}
```

### Database Optimization
```sql
-- Add indexes for common queries
CREATE INDEX idx_matches_player_created 
  ON matches(player_fid, created_at DESC);

CREATE INDEX idx_player_stats_leaderboard 
  ON player_stats(accuracy DESC, avg_speed_ms ASC) 
  WHERE total_matches >= 5;
```

### Bot Response Caching
Pre-generate responses during registration to reduce latency:
```typescript
// In registration flow
await botResponseCache.preGenerateResponses(bot, generateFn);
```

## Monitoring

### Health Check Endpoint
```typescript
// Add to src/app/api/health/route.ts
export async function GET() {
  const checks = {
    redis: await checkRedis(),
    database: await checkDatabase(),
    ably: await checkAbly(),
  };
  
  const healthy = Object.values(checks).every(c => c.status === 'ok');
  return Response.json(checks, { status: healthy ? 200 : 503 });
}
```

### Metrics to Monitor
- Active WebSocket connections
- Redis memory usage
- Database connection pool
- API response times
- Bot response latency

## Troubleshooting

### Chat not connecting
1. Check `NEXT_PUBLIC_ENABLE_WEBSOCKET=true`
2. Verify Ably API key is valid
3. Check browser console for `[Ably]` logs
4. Ensure game state is `LIVE`

### State not persisting
1. Verify `USE_REDIS=true`
2. Check Redis connection: `redis-cli ping`
3. Look for `[Redis]` logs in server output

### Leaderboard not updating
1. Verify `USE_DATABASE=true`
2. Run `npm run db:setup`
3. Check PostgreSQL connection

### High latency
1. Enable bot response caching
2. Use shared Ably channels
3. Add Redis connection pooling
4. Consider regional deployment

## Cost Estimation

### Free Tier Limits
| Service | Free Tier | Estimated Cost at Scale |
|---------|-----------|------------------------|
| Vercel | 100GB bandwidth | $20/mo (Pro) |
| Upstash Redis | 10K commands/day | $10/mo (Pay-as-you-go) |
| Neon PostgreSQL | 3GB storage | $19/mo (Launch) |
| Ably | 200 connections | $29/mo (Standard) |

### Estimated Monthly Cost
- **Small (< 100 users):** $0 (free tiers)
- **Medium (100-500 users):** ~$50-80/mo
- **Large (500-2000 users):** ~$150-300/mo

## Migration Guide

### From In-Memory to Redis
1. Set `USE_REDIS=true`
2. Deploy new version
3. State will automatically use Redis
4. Old in-memory state is lost (start fresh game cycle)

### From No Database to PostgreSQL
1. Run `npm run db:setup`
2. Set `USE_DATABASE=true`
3. Deploy new version
4. Historical data starts fresh

## Support

For issues with scaling:
1. Check this documentation
2. Review server logs for `[Redis]`, `[Database]`, `[Ably]` prefixes
3. Open an issue on GitHub with:
   - Environment configuration (redact secrets)
   - Error messages
   - Expected vs actual behavior