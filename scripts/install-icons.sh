#!/bin/bash
# Install custom app icons into Android mipmap directories
# Run after: npx cap sync android

set -e

ICON_SRC="res/icons-android"
ANDROID_RES="android/app/src/main/res"

if [ ! -d "$ICON_SRC" ]; then
  echo "No custom icon directory found, skipping"
  exit 0
fi

echo "Installing custom app icons..."

for density in mdpi hdpi xhdpi xxhdpi xxxhdpi; do
  SRC="$ICON_SRC/mipmap-${density}.png"
  DST_DIR="$ANDROID_RES/mipmap-${density}"
  if [ -f "$SRC" ]; then
    mkdir -p "$DST_DIR"
    cp "$SRC" "$DST_DIR/ic_launcher.png"
    cp "$SRC" "$DST_DIR/ic_launcher_foreground.png" 2>/dev/null || true
    echo "  Installed mipmap-${density}"
  fi
done

echo "Icons installed successfully"
