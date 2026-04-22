# Running the Scheduler

The `start` command runs the sync on a recurring schedule defined by `SYNC_INTERVAL_HOURS` in your `.env` (default: 6 hours). It runs an initial sync immediately on startup, then repeats on the configured interval.

```bash
beehiiv-notion-sync start
```

## Run in the Background with pm2 (Recommended)

[pm2](https://pm2.keymetrics.io/) is a process manager that keeps your process running across reboots and restarts it on crash.

```bash
# Install pm2 globally
npm install -g pm2

# Start the scheduler
pm2 start "beehiiv-notion-sync start" --name beehiiv-sync

# Save the process list so it restarts on reboot
pm2 save
pm2 startup   # follow the printed command to enable auto-start

# Check status
pm2 status

# View logs
pm2 logs beehiiv-sync

# Stop
pm2 stop beehiiv-sync
```

## Run with nohup (Simple)

```bash
nohup beehiiv-notion-sync start > beehiiv-sync.log 2>&1 &
echo $! > beehiiv-sync.pid

# Stop
kill $(cat beehiiv-sync.pid)
```

## Run as a systemd Service (Ubuntu/Debian)

Create `/etc/systemd/system/beehiiv-sync.service`:

```ini
[Unit]
Description=Beehiiv Notion Sync
After=network.target

[Service]
Type=simple
User=YOUR_USER
WorkingDirectory=/path/to/your/project
ExecStart=/usr/bin/node /path/to/your/project/dist/index.js start
Restart=on-failure
RestartSec=10
EnvironmentFile=/path/to/your/project/.env

[Install]
WantedBy=multi-user.target
```

Then enable and start it:

```bash
sudo systemctl daemon-reload
sudo systemctl enable beehiiv-sync
sudo systemctl start beehiiv-sync
sudo systemctl status beehiiv-sync
```
