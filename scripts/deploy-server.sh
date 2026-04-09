#!/bin/bash
set -e

echo "Deploying Detective API (standalone)..."

cd /opt/detective

echo "Cleaning old build..."
sudo rm -rf .next

echo "Building Next.js API (standalone mode)..."
sudo npm install
sudo npm run build

echo "Copying standalone build..."
sudo rm -rf /opt/detective-deploy
sudo mkdir -p /opt/detective-deploy
sudo cp -r .next/standalone/. /opt/detective-deploy/
sudo cp -r .next/static /opt/detective-deploy/.next/static
sudo cp -r public /opt/detective-deploy/
sudo cp .env.local /opt/detective-deploy/

# Create ecosystem config that loads env vars dynamically
sudo bash -c 'cat > /opt/detective-deploy/ecosystem.config.cjs << '\''ECOFMT'\''
const fs = require("fs");
const path = require("path");

const envFile = path.join(__dirname, ".env.local");
const envVars = fs.existsSync(envFile)
  ? fs.readFileSync(envFile, "utf8")
    .split("\n")
    .filter(line => line.trim() && !line.startsWith("#"))
    .reduce((acc, line) => {
      const [key, ...values] = line.split("=");
      if (key && values.length) acc[key.trim()] = values.join("=").trim();
      return acc;
    }, {})
  : {};

module.exports = {
  apps: [{
    name: "detective-api",
    script: "server.js",
    cwd: "/opt/detective-deploy",
    instances: 1,
    exec_mode: "fork",
    watch: false,
    max_memory_restart: "1G",
    env: {
      NODE_ENV: "production",
      PORT: 4000,
      ...envVars
    }
  }]
};
ECOFMT'

echo "Restarting service..."
sudo pm2 delete detective-api 2>/dev/null || true
sudo pm2 start /opt/detective-deploy/ecosystem.config.cjs
sudo pm2 save

echo "Cleaning up build artifacts from source..."
sudo rm -rf node_modules .next

echo "Done! API deployed. Space optimized."
