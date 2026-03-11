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
sudo cp -r .next/standalone/* /opt/detective-deploy/
sudo cp -r .next/static /opt/detective-deploy/
sudo cp -r public /opt/detective-deploy/

echo "Restarting service..."
sudo pm2 restart detective-api

echo "Cleaning up build artifacts from source..."
sudo rm -rf node_modules .next

echo "Done! API deployed at port 4000"
