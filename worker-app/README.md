# RaipurOne Worker — Android app

A Capacitor wrapper around the field worker page. It is a thin shell on purpose: the page
itself lives at [`backend/app/static/worker.html`](../backend/app/static/worker.html) and
is served by FastAPI at `/worker`, so the browser version and the app are always the same
screen. `sync-page.js` copies that one file into `www/index.html` before every build.

| | |
| --- | --- |
| Package | `in.raipurone.worker` |
| Label | RaipurOne Worker |
| Min Android | 7.0 (API 24) |
| Built against | API 36 |

## Why an app rather than just the web page

Two things the browser cannot give a worker in the field:

- **GPS over a plain-http backend.** Browsers refuse `navigator.geolocation` outside a
  secure context, so `http://192.168.x.x:8000/worker` on a phone can never get a position.
  The app's WebView loads from `https://localhost`, which *is* a secure context, so the
  server can stay on plain http inside the office network.
- **A reliable camera.** The app uses the native camera plugin with the source pinned to
  the camera, so the gallery is not offered at all.

Both fall back to the plain web APIs automatically, so the same file still works when
opened in a browser.

## Install the APK

`RaipurOne-Worker.apk` is a **debug** build — it installs directly, no Play Store. On the
phone: allow "Install unknown apps" for whichever app you send it with, then open the
file. Debug builds are signed with the shared Android debug key, so this is fine for your
own workers but must not be published.

On first launch the app asks for the **server address** (for example
`http://192.168.1.5:8000`). It is saved, so it is only typed once — and logging out keeps
it. Point it at whatever host runs the FastAPI backend.

## Rebuild

Needs a JDK (17 or 21) and the Android SDK with API 36 and build-tools 36.

```bash
cd worker-app
npm install

# One-time, and after moving the SDK: point Gradle at it. Use forward slashes -
# backslashes in a .properties file are escape characters and the build fails with
# "The filename, directory name, or volume label syntax is incorrect".
echo "sdk.dir=C:/Users/<you>/AppData/Local/Android/Sdk" > android/local.properties

npm run build:apk
```

The APK lands in `android/app/build/outputs/apk/debug/app-debug.apk`.

`npm run sync` alone copies the page across and refreshes the native project — run it
after editing `worker.html` if you are building from Android Studio instead.

## Backend requirements

- `CORS_ORIGINS` must include `https://localhost` and `capacitor://localhost`. These are
  the app's own origins, and without them every request from the app is blocked. They are
  in `.env.example` and in the built-in default.
- Run the API on `0.0.0.0` so the phone can reach it:
  `python -m uvicorn app.main:app --host 0.0.0.0 --port 8000`.
- `supabase/work_submissions_migration.sql` must have been applied, or submitting returns
  a 503 naming the migration.

## Release builds

`assembleDebug` is what is committed here because it needs no keystore. For anything
beyond your own team, generate a keystore, add a `signingConfigs` block to
`android/app/build.gradle`, and run `gradlew.bat assembleRelease`.
