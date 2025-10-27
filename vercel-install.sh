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
yum install -y gcc-c++ cairo-devel pango-devel libjpeg-turbo-devel giflib-devel librsvg2-devel

echo "--- Installing Node Dependencies ---"
npm install --platform=linux --arch=x64 --include=dev
