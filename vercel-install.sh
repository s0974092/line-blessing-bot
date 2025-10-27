#!/bin/bash
set -e

echo "--- System Info ---"
uname -a
echo "--- OS Release ---"
cat /etc/os-release || echo "/etc/os-release not found"
echo "--- PATH ---"
echo $PATH
echo "--- Checking for apt-get ---"
which apt-get || echo "apt-get not in PATH"
echo "--- End of Debug ---"

echo "--- Installing System Dependencies ---"
apt-get update && apt-get install -y build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev

echo "--- Installing Node Dependencies ---"
npm install --platform=linux --arch=x64 --include=dev
