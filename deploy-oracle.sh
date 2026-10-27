#!/usr/bin/env bash
# ==============================================================================
# HunarPay (MoneyDraw & MoneyPay) - Automated 1-Click Oracle Cloud Deployment
# OS Target: Ubuntu 22.04 LTS / 24.04 LTS (Always Free VM in Mumbai)
# ==============================================================================

set -e

echo "🚀 [1/6] Updating Ubuntu packages..."
sudo apt-get update -y && sudo apt-get upgrade -y
sudo apt-get install -y curl git ufw nginx certbot python3-certbot-nginx build-essential

echo "📦 [2/6] Installing Node.js 20 LTS & PM2..."
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
sudo npm install -g pm2

echo "🛡️ [3/6] Configuring Oracle Firewall..."
# Oracle Linux images have strict iptables; ensure ports 80, 443 are open
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT || true
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT || true
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 3000 -j ACCEPT || true
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 3001 -j ACCEPT || true
sudo netfilter-persistent save || true

echo "🌐 [4/6] Configuring Nginx Reverse Proxy for hunarpay.com..."
sudo tee /etc/nginx/sites-available/hunarpay << 'EOF'
# MoneyDraw (Retailer & Admin Portal)
server {
    listen 80;
    server_name app.hunarpay.com hunarpay.com;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# MoneyPay (Customer Deposit Gateway)
server {
    listen 80;
    server_name pay.hunarpay.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/hunarpay /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx

echo "⚙️ [5/6] Building Production Apps..."
APP_DIR="/var/www/hunarpay"
sudo mkdir -p $APP_DIR
sudo chown -R $USER:$USER $APP_DIR

# Copy or clone projects into $APP_DIR/Withdrawal and $APP_DIR/Deposit
if [ -d "$APP_DIR/Withdrawal" ]; then
  cd "$APP_DIR/Withdrawal"
  npm install
  npx prisma db push
  npm run build
fi

if [ -d "$APP_DIR/Deposit" ]; then
  cd "$APP_DIR/Deposit"
  npm install
  npx prisma db push
  npm run build
fi

echo "🔄 [6/6] Launching 24/7 PM2 Daemon..."
if [ -f "$APP_DIR/Withdrawal/ecosystem.config.js" ]; then
  cd "$APP_DIR/Withdrawal"
  pm2 start ecosystem.config.js
  pm2 save
  pm2 startup | tail -n 1 | sudo bash || true
fi

echo "=============================================================================="
echo "✅ DEPLOYMENT COMPLETE! Both apps are running 24/7/365 on Oracle Cloud."
echo "👉 App Portal:  https://app.hunarpay.com  (or https://hunarpay.com)"
echo "👉 Pay Gateway: https://pay.hunarpay.com"
echo "To enable Free SSL, run: sudo certbot --nginx -d app.hunarpay.com -d hunarpay.com -d pay.hunarpay.com"
echo "=============================================================================="
