#!/bin/bash
# PocketDev Hetzner Deployment Script
# Run this on your Hetzner VPS after initial setup

set -e

echo "🚀 PocketDev Hetzner Deployment"
echo "================================"

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "Please run as root (use sudo)"
    exit 1
fi

# 1. Install Docker if not present
if ! command -v docker &> /dev/null; then
    echo "📦 Installing Docker..."
    apt-get update
    apt-get install -y ca-certificates curl gnupg
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
fi

# 2. Create data directories
echo "📁 Creating data directories..."
mkdir -p /var/pocketdev/data
mkdir -p /var/pocketdev/projects
mkdir -p /var/pocketdev/backups

# 2b. Setup basic authentication
if [ ! -f "/var/pocketdev/.htpasswd" ]; then
    echo "🔐 Setting up basic authentication..."
    apt-get install -y apache2-utils
    
    echo "Choose a username for PocketDev access:"
    read -p "Username: " AUTH_USER
    
    echo "Choose a password (will be hidden):"
    htpasswd -c /var/pocketdev/.htpasswd "$AUTH_USER"
    
    echo "✅ Basic auth configured for user: $AUTH_USER"
    echo "   You can add more users later with: htpasswd /var/pocketdev/.htpasswd newuser"
else
    echo "🔐 Basic auth already configured (using existing .htpasswd)"
fi

# 3. Clone repository if not exists
if [ ! -d "/opt/pocketdev" ]; then
    echo "📥 Cloning PocketDev repository..."
    git clone https://github.com/jeffeharris/pocketdev.git /opt/pocketdev
    cd /opt/pocketdev
else
    echo "📥 Updating PocketDev repository..."
    cd /opt/pocketdev
    git pull
fi

# 4. Create production .env file
if [ ! -f ".env.production" ]; then
    echo "🔧 Creating .env.production file..."
    cat > .env.production << 'EOF'
# Generated encryption key (change this!)
ENCRYPTION_KEY=$(openssl rand -hex 32)

# Monitor auth key for internal services
MONITOR_AUTH_KEY=$(openssl rand -hex 16)

# Add your API keys here
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GITHUB_TOKEN=

# Domain configuration
DOMAIN_NAME=app.pocketdev.ai
EOF
    echo "⚠️  Please edit .env.production and add your API keys!"
    echo "   nano /opt/pocketdev/.env.production"
    read -p "Press enter after adding your API keys..."
fi

# 5. Load environment variables
set -a
source .env.production
set +a

# 6. Domain is already set in nginx.production.conf (app.pocketdev.ai)
# No need to update it dynamically

# 7. Build and start services
echo "🔨 Building Docker images..."
docker compose -f docker-compose.production.yml build

echo "🚀 Starting services..."
docker compose -f docker-compose.production.yml up -d

# 8. Wait for services to be healthy
echo "⏳ Waiting for services to start..."
sleep 10

# 9. Check service status
echo "✅ Checking service status..."
docker compose -f docker-compose.production.yml ps

# 10. Setup SSL with Certbot (optional)
read -p "Do you want to setup SSL with Let's Encrypt? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    apt-get install -y certbot
    certbot certonly --standalone -d app.pocketdev.ai --non-interactive --agree-tos -m admin@pocketdev.ai
    
    # Update nginx config to use SSL
    sed -i 's/# return 301/return 301/g' nginx.production.conf
    sed -i 's/# server {/server {/g' nginx.production.conf
    sed -i 's/# }/}/g' nginx.production.conf
    
    # Restart nginx
    docker compose -f docker-compose.production.yml restart nginx
fi

# 11. Setup automatic backups
echo "📅 Setting up daily backups..."
cat > /etc/cron.daily/pocketdev-backup << 'EOF'
#!/bin/bash
BACKUP_DIR="/var/pocketdev/backups"
DATE=$(date +%Y%m%d)
sqlite3 /var/pocketdev/data/pocketdev.db ".backup $BACKUP_DIR/pocketdev-$DATE.db"
find $BACKUP_DIR -name "*.db" -mtime +7 -delete
EOF
chmod +x /etc/cron.daily/pocketdev-backup

echo "✨ Deployment complete!"
echo ""
echo "Your PocketDev instance is now running at:"
echo "  http://app.pocketdev.ai (or http://$(curl -s ifconfig.me))"
echo ""
echo "Next steps:"
echo "1. Check logs: docker compose -f docker-compose.production.yml logs -f"
echo "2. Edit API keys if needed: nano /opt/pocketdev/.env.production"
echo "3. Restart after changes: docker compose -f docker-compose.production.yml restart"