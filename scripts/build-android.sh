#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# build-android.sh — Local Android build for Play Store
# ─────────────────────────────────────────────────────────────────────────────
# Produces a signed .aab (Android App Bundle) for Play Store upload.
#
# Prerequisites:
#   • JDK 17+ (`brew install --cask temurin@17`)
#   • Android SDK installed via Android Studio
#   • ANDROID_HOME set, $ANDROID_HOME/platform-tools in $PATH
#   • A release keystore at android/app/diet-plan-release.jks
#     Generate one with: ./scripts/generate-android-keystore.sh
#   • Run `npx cap sync android` once (this script will re-run it)
#
# Usage:
#   ./scripts/build-android.sh                       # build signed .aab
#   ./scripts/build-android.sh debug                 # debug .apk (no signing)
#   ./scripts/build-android.sh release upload        # build + upload to Play internal
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

MODE="${1:-release}"
UPLOAD="${2:-}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_step() { echo -e "\n${GREEN}▶ $1${NC}"; }
print_warn() { echo -e "${YELLOW}⚠ $1${NC}"; }
print_err()  { echo -e "${RED}✗ $1${NC}"; }

# ── Preflight ────────────────────────────────────────────────────────────────
print_step "Preflight checks"

if [ -z "${ANDROID_HOME:-}" ] && [ -z "${ANDROID_SDK_ROOT:-}" ]; then
  print_warn "ANDROID_HOME not set. Trying to auto-detect from common paths..."
  for p in "$HOME/Library/Android/sdk" "/opt/android-sdk" "/usr/local/lib/android/sdk"; do
    if [ -d "$p" ]; then
      export ANDROID_HOME="$p"
      print_warn "Auto-detected: ANDROID_HOME=$p"
      break
    fi
  done
fi

if [ -z "${ANDROID_HOME:-}" ]; then
  print_err "ANDROID_HOME not set. Install Android Studio, then set it."
  exit 1
fi

if ! command -v java &> /dev/null; then
  print_err "Java not found. Install JDK 17+: brew install --cask temurin@17"
  exit 1
fi

JAVA_VER=$(java -version 2>&1 | head -1 | grep -oE '"[0-9]+' | head -1 | tr -d '"' || echo "")
if [ -n "$JAVA_VER" ] && [ "$JAVA_VER" -lt 17 ] 2>/dev/null; then
  print_warn "Java $JAVA_VER detected. Capacitor 8 requires JDK 17+. Set JAVA_HOME explicitly."
fi

if [ ! -d "android" ]; then
  print_err "android/ directory missing. Run: npx cap add android"
  exit 1
fi

# ── Web build ──────────────────────────────────────────────────────────────
print_step "Building web app"
npm run build --prefix client

print_step "Syncing to native project"
npx cap sync android

# ── Bump versionCode ───────────────────────────────────────────────────────
print_step "Bumping versionCode"
PREV_CODE=$(grep -oE 'versionCode [0-9]+' android/app/build.gradle | head -1 | grep -oE '[0-9]+')
NEW_CODE=$((PREV_CODE + 1))
sed -i "s/versionCode $PREV_CODE/versionCode $NEW_CODE/" android/app/build.gradle
print_warn "versionCode: $PREV_CODE → $NEW_CODE"

# ── Verify keystore (release only) ────────────────────────────────────────
if [ "$MODE" = "release" ]; then
  KEYSTORE="android/app/diet-plan-release.jks"
  if [ ! -f "$KEYSTORE" ]; then
    print_err "Keystore not found at $KEYSTORE"
    echo "  Run: ./scripts/generate-android-keystore.sh"
    exit 1
  fi
  print_warn "Using keystore: $KEYSTORE"
fi

# ── Build ──────────────────────────────────────────────────────────────────
print_step "Building .aab"
(cd android && ./gradlew "assemble${MODE^}" bundle"${MODE^}" --no-daemon)

# Locate artifact
if [ "$MODE" = "release" ]; then
  ARTIFACT=$(find android/app/build/outputs/bundle/release -name "*.aab" | head -1)
  if [ -z "$ARTIFACT" ]; then
    print_err ".aab not found in android/app/build/outputs/bundle/release/"
    exit 1
  fi
  print_step "Build complete"
  echo -e "${GREEN}  .aab: $ARTIFACT${NC}"
  echo -e "${GREEN}  Size: $(du -h "$ARTIFACT" | awk '{print $1}')${NC}"
else
  ARTIFACT=$(find android/app/build/outputs/apk/debug -name "*.apk" | head -1)
  print_step "Build complete (debug)"
  echo -e "${GREEN}  .apk: $ARTIFACT${NC}"
fi

echo ""

if [ "$UPLOAD" = "upload" ]; then
  if [ -z "${GOOGLE_APPLICATION_CREDENTIALS:-}" ]; then
    print_err "GOOGLE_APPLICATION_CREDENTIALS not set."
    echo "  1. Create a service account in Google Cloud Console"
    echo "  2. Grant it 'Editor' on your Play Console project"
    echo "  3. Download the JSON key"
    echo "  4. export GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json"
    exit 1
  fi
  print_step "Uploading to Play Console (internal track)"
  (cd android && bundle exec fastlane supply \
    --track internal \
    --aab "$ARTIFACT" \
    --package_name com.dietplan.tracker \
    --json_key "$GOOGLE_APPLICATION_CREDENTIALS" \
    --skip_upload_apk true)
  echo -e "${GREEN}  Uploaded to internal track. Testers will get the build in ~5 min.${NC}"
else
  echo "Next steps:"
  echo "  • Go to Play Console → Release → Internal testing → Create new release"
  echo "  • Upload $ARTIFACT"
  echo "  • Or run: $0 $MODE upload  (auto-uploads via Fastlane)"
fi
