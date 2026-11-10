#!/usr/bin/env bash
# Builds the Dash 955 Android app (APK) without Gradle, from the Ubuntu
# Android SDK packages:
#   sudo apt-get install android-sdk-platform-23 aapt apksigner zipalign dalvik-exchange openjdk-17-jdk-headless
#
# Output: app/dist/dash955.apk, also copied to the site's download folder, and
# the web UI copied to the site as the installable web version (sites/mito-2009/app).
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
SDK="${ANDROID_SDK:-/usr/lib/android-sdk}"
JAR="$SDK/platforms/android-23/android.jar"
BT="$(ls -d "$SDK"/build-tools/* | head -1)"
VERSION_CODE="${VERSION_CODE:-1}"
VERSION_NAME="${VERSION_NAME:-1.0}"
B="$HERE/build"
KS="$HERE/android/signing/dash955.keystore"
KS_PASS="${KS_PASS:-dash955-mito}"

[ -f "$JAR" ] || { echo "android.jar introuvable : $JAR"; exit 1; }

rm -rf "$B"
mkdir -p "$B/gen" "$B/classes" "$B/assets/web" "$HERE/dist"
cp -r "$HERE/web/." "$B/assets/web/"
rm -f "$B/assets/web/sw.js" "$B/assets/web/manifest.webmanifest"

echo "1/5 ressources"
aapt package -f -m \
  -J "$B/gen" \
  -M "$HERE/android/AndroidManifest.xml" \
  -S "$HERE/android/res" \
  -A "$B/assets" \
  -I "$JAR" \
  --min-sdk-version 21 --target-sdk-version 28 \
  --version-code "$VERSION_CODE" --version-name "$VERSION_NAME" \
  -F "$B/unsigned.apk"

echo "2/5 java"
find "$HERE/android/src" "$B/gen" -name '*.java' > "$B/sources.txt"
javac -nowarn -Xlint:-options -encoding UTF-8 -source 8 -target 8 \
  -bootclasspath "$JAR" -d "$B/classes" @"$B/sources.txt"

echo "3/5 dex"
"$BT/dx" --dex --min-sdk-version=21 --output="$B/classes.dex" "$B/classes"
(cd "$B" && aapt add -f unsigned.apk classes.dex > /dev/null)

echo "4/5 signature"
if [ ! -f "$KS" ]; then
  mkdir -p "$(dirname "$KS")"
  keytool -genkeypair -keystore "$KS" -storepass "$KS_PASS" -keypass "$KS_PASS" \
    -alias dash955 -keyalg RSA -keysize 2048 -validity 10000 \
    -dname "CN=Dash 955, O=Dash 955, C=FR" > /dev/null 2>&1
fi
zipalign -f 4 "$B/unsigned.apk" "$B/aligned.apk"
apksigner sign --ks "$KS" --ks-pass "pass:$KS_PASS" --key-pass "pass:$KS_PASS" \
  --out "$HERE/dist/dash955.apk" "$B/aligned.apk"
apksigner verify "$HERE/dist/dash955.apk"

echo "5/5 copie vers le site"
SITE="$ROOT/sites/mito-2009"
if [ -d "$SITE" ]; then
  mkdir -p "$SITE/telechargement" "$SITE/app"
  cp "$HERE/dist/dash955.apk" "$SITE/telechargement/dash955.apk"
  rm -rf "$SITE/app"
  mkdir -p "$SITE/app"
  cp -r "$HERE/web/." "$SITE/app/"
fi
# Paquet pour clé USB : l'APK et sa notice, à copier à la racine de la clé.
rm -f "$HERE/dist/dash955-cle-usb.zip"
(cd "$HERE/dist" && cp "$HERE/usb/LISEZMOI.txt" . && zip -q dash955-cle-usb.zip dash955.apk LISEZMOI.txt && rm -f LISEZMOI.txt)
if [ -d "$SITE" ]; then cp "$HERE/dist/dash955-cle-usb.zip" "$SITE/telechargement/"; fi
ls -l "$HERE/dist/dash955.apk" "$HERE/dist/dash955-cle-usb.zip"
