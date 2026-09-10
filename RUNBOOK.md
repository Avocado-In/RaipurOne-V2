# RaipurOne — Runbook

How to get the whole system up, and what to do about the errors that actually happen.
Everything below has been run on this machine, not guessed at.

---

## 1. Start everything

```powershell
cd "C:\Users\Ayush\Downloads\RaipurOneV2 -akp (1)\RaipurOneV2 -akp"
.\start.ps1
```

Three windows open — backend, dashboard, Telegram bot. The dashboard takes about a
minute to compile the first time; the other two are up in seconds.

```powershell
.\start.ps1 -Stop     # stop all three
.\start.ps1 -Phone    # also arm the USB tunnel for the worker app
```

**Always stop with `-Stop`, not by closing the windows.** Closing a window can leave a
process holding port 8000, and the next start then appears to work while still serving
the old code. `-Stop` frees the ports and clears the bot's lock file.

### Where things are

| | |
| --- | --- |
| Dashboard | http://localhost:3000 |
| Worker page | http://localhost:8000/worker |
| API docs | http://localhost:8000/docs |
| Health check | http://localhost:8000/health |
| Telegram bot | [@RaipurOneV2Bot](https://t.me/RaipurOneV2Bot) |

### Logins

| Who | Username | Password |
| --- | --- | --- |
| Worker (Roads) | `worker_roads` | `Sadak@2026` |
| Worker (Water) | `worker_water` | `Paani@2026` |
| Worker (Sanitation) | `worker_sanitation` | `Safai@2026` |
| Admin | `admin` | *(set separately — not stored here)* |

Only an **admin** can send civic broadcasts. Workers can log in to the worker app only.

---

## 2. Check it actually came up

```bash
curl http://localhost:8000/health
```

A healthy system answers:

```json
{"status":"ok","storage":{"supabase_reachable":true},"telegram":{"token_configured":true}}
```

- `"status":"degraded"` → Supabase is unreachable. Check `SUPABASE_URL` and
  `SUPABASE_SERVICE_ROLE_KEY` in `.env`, and that the project is not paused.
- `"token_configured":false` → `TELEGRAM_BOT_TOKEN` is missing from `.env`.

The bot is up when its window says:

```
Telegram bot connected as @RaipurOneV2Bot and is waiting for messages
```

---

## 3. First-time setup only

Skip this if the system has run on this machine before.

### `.env`

Must exist in the project root with these filled in:

```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_ANON_KEY=
TELEGRAM_BOT_TOKEN=
JWT_SECRET=
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,https://localhost,capacitor://localhost
```

`https://localhost` and `capacitor://localhost` are the Android app's own origins. Leave
them out and every request from the phone is blocked by CORS with nothing useful on
screen to say why.

`JWT_SECRET` is optional in development — a random one is generated at startup, which
just means everyone is logged out on restart. It is **required** in production.

### Dependencies

```powershell
cd backend ; pip install -r requirements.txt
cd ..\dashboard-frontend ; npm install
```

### Database migrations

Run each of these once, in the Supabase SQL editor
(https://supabase.com/dashboard/project/wcyasyzqoqhhwpkwfxee/sql/new):

| File | Without it |
| --- | --- |
| `supabase/schema.sql` | Nothing works |
| `supabase/telegram_migration.sql` | The bot refuses to start |
| `supabase/work_submissions_migration.sql` | Worker submit → 503 |
| `supabase/broadcasts_migration.sql` | Push Notifications page → 503 |
| `supabase/telegram_subscribers_migration.sql` | Broadcasts miss anyone who only pressed `/start` |

All five are already applied to the live project.

### AI model

The classifier lives in `backend/models/grievance_classifier/`. It is **not** in git —
the weights file is over 1 GB. Without it the backend still runs and falls back to
rule-based classification.

---

## 4. Worker phone app

The app is at `worker-app/RaipurOne-Worker.apk`. Install it with the phone on USB:

```powershell
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adb install -r worker-app\RaipurOne-Worker.apk
& $adb reverse tcp:8000 tcp:8000
```

In the app, **Server address** → `http://localhost:8000`

That address works over the USB cable regardless of WiFi. If the phone is on the same
WiFi instead, use `http://<laptop-ip>:8000` — find it with `ipconfig`.

> **Use the app, not the browser, on a phone.** Browsers refuse GPS on a plain-`http`
> address, and a submission without GPS is rejected by design. The app's WebView loads
> from `https://localhost`, which counts as secure, so location works.

Rebuild after changing `backend/app/static/worker.html`:

```powershell
cd worker-app
npm run build:apk
```

---

## 5. Errors and what they mean

### `The work_submissions table does not exist`
Run `supabase/work_submissions_migration.sql`. Same shape of message names whichever
migration is missing — read which table it says.

### Restarting changes nothing / old code keeps running
A dead uvicorn is still holding port 8000.

```powershell
.\start.ps1 -Stop
.\start.ps1
```

### `Telegram bot already running (PID …)`
A killed bot left `backend/.telegram-bot.lock` behind.

```powershell
Remove-Item backend\.telegram-bot.lock
```

`.\start.ps1 -Stop` does this for you.

### Bot log: `Conflict: terminated by other getUpdates request`
Two bot instances are polling the same token. Only one may run — stop the other, wait
a few seconds, start again.

### A change to the worker page doesn't show up
Browser cache. Hard-refresh with `Ctrl+Shift+R`. The page is served `no-cache` now, so
this should be rare; in the app, reinstall the APK.

### `Location permission` error in a phone browser
Expected — see the note in section 4. Use the APK.

### Push Notifications shows "Could not load"
Check `/health` first. If Supabase is fine, the broadcasts migration has not been run.

### Tests crash with `Windows fatal exception: access violation` (torch)
The Telegram bot already has the 1.1 GB model loaded and pytest tries to load a second
copy. Stop the bot before running tests, or:

```powershell
$env:AI_PROVIDER = "rule_based"; python -m pytest backend -q
```

One test (`test_default_ai_provider_prefers_local_model_mode`) fails under that flag by
design — it asserts what the *default* is. Everything else should pass.

### APK build: `The filename, directory name, or volume label syntax is incorrect`
`worker-app/android/local.properties` uses backslashes. In a `.properties` file a
backslash is an escape character. Use forward slashes:

```
sdk.dir=C:/Users/Ayush/AppData/Local/Android/Sdk
```

---

## 6. Tests

```powershell
cd backend ; python -m pytest -q                    # stop the bot first
cd ..\dashboard-frontend ; npm test -- --watchAll=false
```

Backend 56 pass, frontend 26 pass.

Broadcast tests stub the Telegram call — the suite must never be one bad patch away from
messaging a real city.

---

## 7. Things that reach real people

These are not undoable. Be deliberate.

- **Any complaint status change** sends the citizen a Telegram message, if their
  complaint came in through the bot. Marking something resolved four times messages them
  four times.
- **Push Notifications → Send** messages every citizen who has ever opened the bot. The
  confirm dialog tells you how many.
- **Approving a work submission** resolves the complaint and messages the citizen.

To test the worker flow without messaging anyone, use a complaint whose
`telegram_chat_id` is null — a web-filed one — or create a throwaway row.

---

## 8. How the worker flow fits together

```
citizen → Telegram bot → complaint (submitted)
                              ↓  admin assigns on the dashboard
                         assigned
                              ↓  worker submits photo + GPS from the app
                        under_review  ──→ citizen told "being reviewed"
                              ↓  admin reviews in Worker Submissions
        approve → resolved ──→ citizen told "resolved"
        send back → in_progress ──→ worker sees the reason on the task
```

A submission is refused unless it carries a fresh photo **and** a GPS fix. When the
complaint has coordinates of its own, the worker must also be within 300 m of them.
Telegram complaints carry no location pin, so those are accepted and flagged
`location_verified: false` rather than blocked.

Tune the rules in `.env`:

```
WORK_GEOFENCE_METRES=300
WORK_MAX_GPS_ACCURACY_METRES=200
WORK_PHOTO_MAX_AGE_MINUTES=60
```
