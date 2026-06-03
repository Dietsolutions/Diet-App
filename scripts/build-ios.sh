#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# build-ios.sh — Local iOS build for App Store / TestFlight
# ─────────────────────────────────────────────────────────────────────────────
# Produces a signed .ipa using your locally-installed Xcode.
#
# Prerequisites:
#   • macOS with Xcode 15+
#   • Apple Developer Program membership ($99/yr)
#   • Bundle ID registered in App Store Connect
#   • Provisioning profile installed (Xcode → Settings → Accounts)
#   • Run `npx cap sync ios` once (this script will re-run it)
#
# Usage:
#   ./scripts/build-ios.sh                  # release build
#   ./scripts/build-ios.sh debug           # debug build (for simulator)
#   ./scripts/build-ios.sh release upload  # build + upload to TestFlight
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

if [[ "$(uname)" != "Darwin" ]]; then
  print_err "iOS builds require macOS. Use build-android.sh on Linux/Windows."
  exit 1
fi

if ! command -v xcodebuild &> /dev/null; then
  print_err "xcodebuild not found. Install Xcode 15+ from the App Store."
  exit 1
fi

if ! command -v pod &> /dev/null; then
  print_err "CocoaPods not found. Install: sudo gem install cocoapods"
  exit 1
fi

if [ ! -d "ios" ]; then
  print_err "ios/ directory missing. Run: npx cap add ios"
  exit 1
fi

print_step "Building web app"
npm run build --prefix client

print_step "Syncing to native project"
npx cap sync ios

# ── Bump build number (so each local build has a unique CFBundleVersion) ───
print_step "Bumping build number"
PREV_BUILD=$(/usr/libexec/PlistBuddy -c "Print :CFBundleVersion" ios/App/App/Info.plist)
NEW_BUILD=$((PREV_BUILD + 1))
/usr/libexec/PlistBuddy -c "Set :CFBundleVersion $NEW_BUILD" ios/App/App/Info.plist
print_warn "CFBundleVersion: $PREV_BUILD → $NEW_BUILD"

# ── Install Pods ────────────────────────────────────────────────────────────
print_step "Installing CocoaPods"
(cd ios && pod install --repo-update)

# ── Archive ─────────────────────────────────────────────────────────────────
print_step "Archiving Xcode project"
(cd ios && xcodebuild \
  -workspace App.xcworkspace \
  -scheme App \
  -configuration "${MODE^}" \
  -destination 'generic/platform=iOS' \
  -archivePath build/App.xcarchive \
  CODE_SIGN_STYLE=manual \
  archive)

# ── Export ──────────────────────────────────────────────────────────────────
print_step "Exporting .ipa"
mkdir -p ios/build/ipa
(cd ios && xcodebuild \
  -exportArchive \
  -archivePath build/App.xcarchive \
  -exportPath build/ipa \
  -exportOptionsPlist build/ExportOptions.plist)

IPA_PATH=$(find ios/build/ipa -name "*.ipa" | head -1)
if [ -z "$IPA_PATH" ]; then
  print_err ".ipa not found in ios/build/ipa/"
  exit 1
fi

print_step "Build complete"
echo -e "${GREEN}  .ipa: $IPA_PATH${NC}"
echo -e "${GREEN}  Size: $(du -h "$IPA_PATH" | awk '{print $1}')${NC}"
echo ""

if [ "$UPLOAD" = "upload" ]; then
  if ! command -v xcrun &> /dev/null; then
    print_err "xcrun not found. Cannot upload to TestFlight."
    exit 1
  fi
  print_step "Uploading to TestFlight"
  xcrun altool --upload-app \
    --type ios \
    --file "$IPA_PATH" \
    --apiKey "$APPLE_CONNECT_API_KEY_PATH" \
    --apiIssuer "$APPLE_CONNECT_API_ISSUER" 2>/dev/null \
  || xcrun altool --upload-app \
    --type ios \
    --file "$IPA_PATH" \
    --username "$APPLE_ID" \
    --password "$APP_SPECIFIC_PASSWORD"
  echo -e "${GREEN}  Uploaded. Check App Store Connect → TestFlight in ~5 min.${NC}"
else
  echo "Next steps:"
  echo "  • Open Xcode → Window → Organizer → App.xcarchive → Distribute App"
  echo "  • Or run: $0 $MODE upload   (auto-uploads to TestFlight)"
  echo "  • Or use Transporter app: drag the .ipa into it"
fi
