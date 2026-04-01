# Deploy To Fly.io

This app is set up to run on Fly.io as a single service:

- frontend built with Vite
- backend served by Express
- SQLite, logs, and backups stored on a persistent Fly volume

## 1. Install Flyctl

Use the official Fly.io CLI:

[https://fly.io/docs/flyctl/install/](https://fly.io/docs/flyctl/install/)

## 2. Login

```powershell
fly auth login
```

## 3. Create the app and volume

If you keep the default name from `fly.toml`:

```powershell
fly apps create lhma-hockey-league
fly volumes create lhma_data --region yyz --size 3
```

If the app name is already taken, change the `app` name in [fly.toml](C:/Users/jp/OneDrive/Documents/test%20tiktok%20app/hockey-league-copy/fly.toml) first.

## 4. Set production secrets

```powershell
fly secrets set JWT_SECRET="replace-with-a-long-random-secret"
fly secrets set DEFAULT_SYSTEM_PASSWORD="replace-with-a-strong-admin-password"
fly secrets set FRONTEND_URL="https://lhma-hockey-league.fly.dev"
```

If you rename the app, use that Fly URL instead.

## 5. Deploy

```powershell
fly deploy
```

## 6. Open the app

```powershell
fly open
```

## Notes

- Production mode is locked to persistent startup behavior.
- The SQLite database will live at `/data/hockey_league.db`.
- Logs will be written to `/data/logs`.
- Server-side backups will be written to `/data/backups`.
- The backend already serves `frontend/dist` in production.

## Recommended first login steps

1. Sign in as `admin`
2. Change the admin password from the default you used for deployment
3. Create a server backup from Administration
4. Export a JSON backup locally too
