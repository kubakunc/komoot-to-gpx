# Release signing — how to make a signed AAB

Play Store requires the AAB to be signed with a release **upload key**. Google
Play App Signing then re-signs it with the actual app signing key on their
side, so even if the upload key is ever lost, you can recover.

We commit nothing related to signing — neither the keystore nor the password.
Both live only on this machine + a backup you control (1Password, encrypted
drive, etc.).

## One-time setup

### 1. Generate the upload keystore

Pick a strong password (you will need to remember or store this somewhere
permanent — losing it means you cannot ship app updates from this machine).

```bash
cd mobile/android
keytool -genkey -v \
  -keystore upload-keystore.jks \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -alias upload
```

`keytool` will ask:

- "Enter keystore password" / "Re-enter new password" — pick a strong one
- "What is your first and last name?" — `Jakub Kunc` (or however you want CN)
- "What is the name of your organizational unit?" — `Mobile`
- "What is the name of your organization?" — `VeloLogic Labs`
- "What is the name of your City or Locality?" — `Warsaw`
- "What is the name of your State or Province?" — `Mazowieckie`
- "What is the two-letter country code for this unit?" — `PL`
- "Is CN=..., OU=..., O=VeloLogic Labs, ... correct?" — `yes`
- "Enter key password for <upload>" — press Enter to reuse the keystore
  password (simpler — or pick a separate one)

Result: `mobile/android/upload-keystore.jks` (already gitignored).

### 2. Wire the password into Gradle

Copy the example and fill in real values:

```bash
cp keystore.properties.example keystore.properties
```

Edit `keystore.properties`:

```properties
storePassword=THE_PASSWORD_YOU_PICKED_ABOVE
keyPassword=SAME_PASSWORD_IF_YOU_PRESSED_ENTER
keyAlias=upload
storeFile=upload-keystore.jks
```

`mobile/android/keystore.properties` is gitignored too.

### 3. Back up the keystore

**Right now**, before doing anything else:

- Copy `upload-keystore.jks` to 1Password / Bitwarden as a file attachment.
- Copy the password to the same vault entry.
- Optionally export an encrypted copy to an offline drive.

If you ever lose both the file and the password, you cannot publish updates
from this machine — you'd have to go through Play Console's upload-key-reset
flow (Google asks for a new key, signs with their own, you start over).

## Building a signed AAB

After the one-time setup:

```bash
cd mobile
npm run build
npx cap sync android
cd android
./gradlew bundleRelease
```

Output: `mobile/android/app/build/outputs/bundle/release/app-release.aab`

Verify it's signed:

```bash
jarsigner -verify -verbose app/build/outputs/bundle/release/app-release.aab \
  | tail -3
```

You want to see `jar verified.` If you see `jar is unsigned`, `keystore.properties`
is missing or wrong — re-check step 2.

## Versioning subsequent builds

Each new AAB pushed to Play needs a unique `versionCode`. Bump both fields
in `mobile/android/app/build.gradle`:

```groovy
versionCode 1       // → 2 for next release, 3 after, etc. Strictly monotonic.
versionName "1.0"   // → "1.0.1" for a bugfix, "1.1" for a feature, etc.
```

Then `./gradlew bundleRelease` again.
