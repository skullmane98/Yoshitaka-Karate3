# Yoshitaka VPS Deployment

Everything in this folder is for the **Hostinger VPS migration** (away from Render + Hostinger shared hosting). Single-box layout:

```
┌──────────────────── VPS (Ubuntu 24.04, KVM 1) — 187.77.15.182 ────────────────────┐
│  nginx :80/:443                                                                   │
│    ├─ yoshitakakaratedo.com, www.yoshitakakaratedo.com  →  /srv/yoshitaka/app/    │
│    │                                                       frontend/build (SPA)   │
│    └─ api.yoshitakakaratedo.com                          →  proxy_pass 127.0.0.1:8001
│                                                                                   │
│  systemd: yoshitaka-api.service  →  gunicorn (uvicorn worker)  :8001              │
│  systemd: mysql.service          →  MySQL 8 (local socket only)                   │
└───────────────────────────────────────────────────────────────────────────────────┘
```

DNS (set in Hostinger DNS Zone Editor):
```
A   @     187.77.15.182
A   www   187.77.15.182
A   api   187.77.15.182
```

---

## First-time setup (run as `yoshi` after creating the sudo user)

```bash
sudo apt update && sudo apt -y upgrade
sudo apt -y install nginx mysql-server python3.11 python3.11-venv \
    python3-pip git certbot python3-certbot-nginx build-essential
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt -y install nodejs && sudo npm i -g yarn

sudo mysql_secure_installation     # set root password, drop test DB
sudo mysql <<'SQL'
CREATE DATABASE yoshitaka CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'yoshi_app'@'localhost' IDENTIFIED BY 'REPLACE_WITH_STRONG_PASS';
GRANT ALL ON yoshitaka.* TO 'yoshi_app'@'localhost';
FLUSH PRIVILEGES;
SQL

# Tune MySQL for KVM 1 (4 GB RAM)
sudo tee /etc/mysql/mysql.conf.d/yoshitaka.cnf >/dev/null <<'EOF'
[mysqld]
innodb_buffer_pool_size = 256M
max_connections = 50
performance_schema = OFF
EOF
sudo systemctl restart mysql

# Swap (cheap insurance against yarn-build OOM)
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Firewall
sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable

# Clone the repo
sudo mkdir -p /srv/yoshitaka && sudo chown $USER:$USER /srv/yoshitaka
cd /srv/yoshitaka
git clone https://github.com/<your-org>/<your-repo>.git app
cd app

# Backend venv + deps
cd backend
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt gunicorn
deactivate
cd ..

# Backend env file (read by systemd)
sudo cp deploy/yoshitaka-api.env.example /etc/yoshitaka-api.env
sudo nano /etc/yoshitaka-api.env          # fill in DATABASE_URL + JWT_SECRET
sudo chmod 600 /etc/yoshitaka-api.env

# systemd unit
sudo cp deploy/yoshitaka-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now yoshitaka-api
sudo systemctl status yoshitaka-api      # should be active (running)
curl http://127.0.0.1:8001/api/health    # {"status":"ok",...}

# Frontend production build
cd frontend
echo "REACT_APP_BACKEND_URL=https://api.yoshitakakaratedo.com" > .env.production
yarn install --frozen-lockfile
yarn build
cd ..

# Nginx site
sudo cp deploy/nginx-yoshitaka.conf /etc/nginx/sites-available/yoshitaka
sudo ln -sf /etc/nginx/sites-available/yoshitaka /etc/nginx/sites-enabled/yoshitaka
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

# HTTPS (free, auto-renews)
sudo certbot --nginx \
  -d yoshitakakaratedo.com \
  -d www.yoshitakakaratedo.com \
  -d api.yoshitakakaratedo.com

# Daily MySQL backup
sudo mkdir -p /srv/backups && sudo chown $USER:$USER /srv/backups
( crontab -l 2>/dev/null; \
  echo '0 3 * * * mysqldump yoshitaka | gzip > /srv/backups/yoshitaka-$(date +\%F).sql.gz'; \
  echo '0 4 * * * find /srv/backups -name "*.sql.gz" -mtime +14 -delete' ) | crontab -
```

---

## Day-to-day deploys

After pushing to GitHub:
```bash
ssh yoshi@187.77.15.182
cd /srv/yoshitaka/app
./deploy/deploy.sh
```

That script pulls, installs new Python/Node deps, restarts the API service, rebuilds the frontend, and reloads nginx — usually under 90 s.

---

## Useful diagnostics

```bash
sudo journalctl -u yoshitaka-api -f      # live API logs
sudo tail -f /var/log/nginx/error.log    # nginx errors
sudo systemctl restart yoshitaka-api     # restart API only
curl https://api.yoshitakakaratedo.com/api/health
curl https://api.yoshitakakaratedo.com/api/status   # deep probe
```

Roll back to a previous deploy:
```bash
cd /srv/yoshitaka/app && git log --oneline | head
git checkout <commit-sha>
./deploy/deploy.sh
```
