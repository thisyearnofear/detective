# Test Scripts

Debugging and testing scripts for Detective game.

## Available Scripts

### 1. Check Game State
```bash
node scripts/check-state.js
```
Shows current game state, registered players, and bots.

### 2. Register Users
```bash
node scripts/register-users.js <username1> <username2> ...
```
Register one or more Farcaster users.

**Example:**
```bash
node scripts/register-users.js dwr v papa
```

### 3. Test Neynar API
```bash
node scripts/test-neynar.js <username>
```
Test Neynar API connectivity and data fetching.

**Example:**
```bash
node scripts/test-neynar.js dwr
```

## Usage

Make sure your dev server is running:
```bash
PORT=4949 npm run dev
```

Then run any script in a new terminal.

## Environment Variables

Scripts will use:
- `PORT` - Server port (default: 4949)
- `NEYNAR_API_KEY` - From .env.local

## Troubleshooting

If registration fails:
1. Run `test-neynar.js` to verify API connectivity
2. Run `check-state.js` to see current state
3. Check server logs for errors
