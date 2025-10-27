#!/bin/bash
set -e

echo "--- Installing System Dependencies ---"
yum install -y gcc-c++ cairo-devel pango-devel libjpeg-turbo-devel giflib-devel librsvg2-devel pixman

echo "--- Copying ALL Shared Libraries ---"
mkdir -p lib

# Find and copy all potentially required .so files and their symlinks
find /usr/lib64 -name "libpixman-1.so*" -exec cp -d {} lib/ \;
find /usr/lib64 -name "libcairo.so*" -exec cp -d {} lib/ \;
find /usr/lib64 -name "libpango-1.0.so*" -exec cp -d {} lib/ \;
find /usr/lib64 -name "libjpeg.so*" -exec cp -d {} lib/ \;
find /usr/lib64 -name "libgif.so*" -exec cp -d {} lib/ \;
find /usr/lib64 -name "librsvg-2.so*" -exec cp -d {} lib/ \;
find /usr/lib64 -name "libfontconfig.so*" -exec cp -d {} lib/ \;
find /usr/lib64 -name "libfreetype.so*" -exec cp -d {} lib/ \;
find /usr/lib64 -name "libfribidi.so*" -exec cp -d {} lib/ \;
find /usr/lib64 -name "libgdk_pixbuf-2.0.so*" -exec cp -d {} lib/ \;
find /usr/lib64 -name "libgio-2.0.so*" -exec cp -d {} lib/ \;
find /usr/lib64 -name "libglib-2.0.so*" -exec cp -d {} lib/ \;
find /usr/lib64 -name "libgobject-2.0.so*" -exec cp -d {} lib/ \;
find /usr/lib64 -name "libharfbuzz.so*" -exec cp -d {} lib/ \;
find /usr/lib64 -name "libpng16.so*" -exec cp -d {} lib/ \;
find /usr/lib64 -name "libz.so*" -exec cp -d {} lib/ \;

echo "--- Contents of lib/ folder ---"
ls -lR lib

echo "--- Installing Node Dependencies ---"
npm install --platform=linux --arch=x64 --include=dev