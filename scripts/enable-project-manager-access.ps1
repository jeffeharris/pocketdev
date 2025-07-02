# PowerShell script to forward port 3005 from Windows to WSL2
# Run this in an elevated PowerShell window on Windows

# Get WSL2 IP address
$wsl_ip = (wsl hostname -I).trim()
Write-Host "WSL2 IP: $wsl_ip"

# Remove existing rule
netsh interface portproxy delete v4tov4 listenport=3005 listenaddress=0.0.0.0

# Add new forwarding rule
netsh interface portproxy add v4tov4 listenport=3005 listenaddress=0.0.0.0 connectport=3005 connectaddress=$wsl_ip
Write-Host "Forwarded port 3005 to WSL2"

# Add firewall rule
New-NetFirewallRule -DisplayName "WSL2 Port 3005" -Direction Inbound -LocalPort 3005 -Protocol TCP -Action Allow -ErrorAction SilentlyContinue

# Show current rules
Write-Host "`nCurrent port forwarding rules:"
netsh interface portproxy show all

Write-Host "`nDone! Project Manager (port 3005) should now be accessible from your local network."
Write-Host "Access it using your Windows IP address: http://<windows-ip>:3005"