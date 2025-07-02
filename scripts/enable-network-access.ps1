# PowerShell script to forward ports from Windows to WSL2
# Run this in an elevated PowerShell window on Windows

# Get WSL2 IP address
$wsl_ip = (wsl hostname -I).trim()
Write-Host "WSL2 IP: $wsl_ip"

# Define ports to forward
$ports = @(2424, 3005, 3006, 5678, 6333, 7681, 8080, 11434)

# Remove existing rules
foreach ($port in $ports) {
    netsh interface portproxy delete v4tov4 listenport=$port listenaddress=0.0.0.0
}

# Add new forwarding rules
foreach ($port in $ports) {
    netsh interface portproxy add v4tov4 listenport=$port listenaddress=0.0.0.0 connectport=$port connectaddress=$wsl_ip
    Write-Host "Forwarded port $port to WSL2"
}

# Show current rules
Write-Host "`nCurrent port forwarding rules:"
netsh interface portproxy show all

# Add firewall rules
foreach ($port in $ports) {
    New-NetFirewallRule -DisplayName "WSL2 Port $port" -Direction Inbound -LocalPort $port -Protocol TCP -Action Allow -ErrorAction SilentlyContinue
}

Write-Host "`nDone! Your services should now be accessible from your local network."
Write-Host "Access them using your Windows IP address and the respective ports."