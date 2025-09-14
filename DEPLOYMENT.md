# PocketDev Hetzner Deployment Guide

## Quick Start (5 minutes)

### 1. Get a Hetzner VPS
- Go to [Hetzner Cloud](https://www.hetzner.com/cloud)
- Create account and add payment method
- Create new server:
  - **Location**: Choose closest to you
  - **Image**: Ubuntu 22.04
  - **Type**: CX21 (€5.50/month) or CX31 (€10/month) 
  - **SSH Key**: Add your public key
  - **Name**: pocketdev

### 2. Connect to Your Server
```bash
ssh root@YOUR_SERVER_IP
```

### 3. Run Quick Deploy
```bash
# Download and run deployment script
curl -O https://raw.githubusercontent.com/jeffeharris/pocketdev/main/deploy-hetzner.sh
chmod +x deploy-hetzner.sh
./deploy-hetzner.sh
```

### 4. Configure API Keys
Edit the `.env.production` file:
```bash
nano /opt/pocketdev/.env.production
```

Add your keys:
```env
ANTHROPIC_API_KEY=sk-ant-...
GITHUB_TOKEN=ghp_...
DOMAIN_NAME=app.pocketdev.ai
```

### 5. Restart Services
```bash
cd /opt/pocketdev
docker compose -f docker-compose.production.yml restart
```

## That's It! 🎉

Your PocketDev instance is now running at:
- `http://YOUR_SERVER_IP` (before DNS setup)
- `https://app.pocketdev.ai` (after DNS + SSL setup)

---

## Manual Step-by-Step Setup

If you prefer to set up manually:

### 1. SSH into Hetzner VPS
```bash
ssh root@YOUR_SERVER_IP
```

### 2. Install Docker
```bash
apt update && apt upgrade -y
curl -fsSL https://get.docker.com | sh
```

### 3. Clone Repository
```bash
git clone https://github.com/jeffeharris/pocketdev.git /opt/pocketdev
cd /opt/pocketdev
```

### 4. Create Data Directories
```bash
mkdir -p /var/pocketdev/{data,projects,backups}
```

### 5. Create Production Environment File
```bash
cat > .env.production << EOF
ENCRYPTION_KEY=$(openssl rand -hex 32)
MONITOR_AUTH_KEY=$(openssl rand -hex 16)
ANTHROPIC_API_KEY=your_key_here
GITHUB_TOKEN=your_token_here
DOMAIN_NAME=app.pocketdev.ai
EOF
```

### 6. Start Services
```bash
docker compose -f docker-compose.production.yml up -d
```

### 7. Check Status
```bash
docker compose -f docker-compose.production.yml ps
docker compose -f docker-compose.production.yml logs -f
```

## Setting up app.pocketdev.ai DNS

### 1. Point Domain to Hetzner Server
In your DNS provider for pocketdev.ai, add:
```
Type: A
Name: app
Value: YOUR_HETZNER_SERVER_IP
TTL: 300 (5 minutes for testing, increase later)
```

Wait 5-10 minutes for DNS propagation. Test with:
```bash
nslookup app.pocketdev.ai
ping app.pocketdev.ai
```

### 2. Install SSL Certificate
```bash
# Stop nginx temporarily to free port 80
docker compose -f docker-compose.production.yml stop nginx

# Get SSL certificate
apt install certbot
certbot certonly --standalone -d app.pocketdev.ai

# Start nginx again
docker compose -f docker-compose.production.yml start nginx
```

### 3. Enable HTTPS in Nginx
The nginx.production.conf is already configured for app.pocketdev.ai.
Just uncomment the HTTPS sections:

```bash
cd /opt/pocketdev
# Uncomment HTTPS redirect
sed -i 's/# return 301/return 301/g' nginx.production.conf
# Uncomment HTTPS server block (manual edit needed for the full block)
nano nginx.production.conf
```

Uncomment lines 74-82 (the HTTPS server block)

### 4. Restart Nginx
```bash
docker compose -f docker-compose.production.yml restart nginx
```

## Maintenance

### View Logs
```bash
cd /opt/pocketdev
docker compose -f docker-compose.production.yml logs -f [service-name]
```

### Backup Database
```bash
sqlite3 /var/pocketdev/data/pocketdev.db ".backup /var/pocketdev/backups/pocketdev-$(date +%Y%m%d).db"
```

### Update PocketDev
```bash
cd /opt/pocketdev
git pull
docker compose -f docker-compose.production.yml build
docker compose -f docker-compose.production.yml up -d
```

### Monitor Resources
```bash
docker stats
df -h
free -h
```

## Troubleshooting

### Services Won't Start
```bash
# Check logs
docker compose -f docker-compose.production.yml logs

# Check disk space
df -h

# Restart everything
docker compose -f docker-compose.production.yml down
docker compose -f docker-compose.production.yml up -d
```

### Can't Access Web Interface
```bash
# Check if services are running
docker ps

# Check firewall (Hetzner firewall or ufw)
ufw status

# Test locally
curl http://localhost
```

### Database Issues
```bash
# Backup current database
cp /var/pocketdev/data/pocketdev.db /var/pocketdev/backups/pocketdev-backup.db

# Check database integrity
sqlite3 /var/pocketdev/data/pocketdev.db "PRAGMA integrity_check;"
```

## Security Notes

1. **Change default keys**: Always generate new encryption keys
2. **Firewall**: Only open ports 80, 443, and 22 (SSH)
3. **Updates**: Keep system updated with `apt update && apt upgrade`
4. **Backups**: Regular backups are automatically configured
5. **SSH**: Use SSH keys, disable password authentication

## Costs

- **Hetzner CX21**: ~€5.50/month (2 vCPU, 4GB RAM, 40GB SSD)
- **Hetzner CX31**: ~€10/month (2 vCPU, 8GB RAM, 80GB SSD) - Recommended
- **Domain**: €10-15/year (optional)
- **Total**: €5.50-10/month