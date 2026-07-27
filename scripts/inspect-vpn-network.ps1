param(
    [switch]$SkipTrace,
    [string]$TraceTarget = "8.8.8.8",
    [string]$ExportJsonPath
)

$ErrorActionPreference = "Stop"

function Write-Section {
    param([string]$Title)
    Write-Host ""
    Write-Host "=== $Title ===" -ForegroundColor Cyan
}

function Try-Run {
    param([scriptblock]$Block, $Default = $null)
    try {
        & $Block
    } catch {
        $Default
    }
}

$vpnPattern = "vpn|tap|wintun|wireguard|tun|forti|cisco|anyconnect|globalprotect|tailscale|zscaler"

$adapters = Get-NetAdapter -ErrorAction SilentlyContinue |
    Sort-Object ifIndex |
    Select-Object ifIndex, Name, InterfaceDescription, Status, MacAddress, LinkSpeed

$ipConfigs = Get-NetIPConfiguration -ErrorAction SilentlyContinue |
    Select-Object InterfaceAlias, InterfaceDescription, IPv4Address, IPv4DefaultGateway, DNSServer

$routes = Get-NetRoute -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Sort-Object RouteMetric, DestinationPrefix |
    Select-Object ifIndex, InterfaceAlias, DestinationPrefix, NextHop, RouteMetric, PolicyStore

$dns = Get-DnsClientServerAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Sort-Object InterfaceIndex |
    Select-Object InterfaceIndex, InterfaceAlias, ServerAddresses

$interfaces = Get-NetIPInterface -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Sort-Object InterfaceMetric |
    Select-Object ifIndex, InterfaceAlias, ConnectionState, Dhcp, InterfaceMetric, NlMtu

$profiles = Get-NetConnectionProfile -ErrorAction SilentlyContinue |
    Select-Object Name, InterfaceAlias, NetworkCategory, IPv4Connectivity, IPv6Connectivity

$vpnAdapters = $adapters | Where-Object {
    $_.Name -match $vpnPattern -or $_.InterfaceDescription -match $vpnPattern
}

$activeVpnAdapters = $vpnAdapters | Where-Object { $_.Status -eq "Up" }
$activeVpnIndexes = @($activeVpnAdapters | ForEach-Object { $_.ifIndex })

$fullTunnelRoutes = @()
foreach ($index in $activeVpnIndexes) {
    $vpnRoutes = @($routes | Where-Object { $_.ifIndex -eq $index })
    $hasDefault = $vpnRoutes | Where-Object { $_.DestinationPrefix -eq "0.0.0.0/0" }
    $hasLowerHalf = $vpnRoutes | Where-Object { $_.DestinationPrefix -eq "0.0.0.0/1" }
    $hasUpperHalf = $vpnRoutes | Where-Object { $_.DestinationPrefix -eq "128.0.0.0/1" }

    if ($hasDefault -or ($hasLowerHalf -and $hasUpperHalf)) {
        $fullTunnelRoutes += $vpnRoutes | Where-Object {
            $_.DestinationPrefix -in @("0.0.0.0/0", "0.0.0.0/1", "128.0.0.0/1")
        }
    }
}

$publicIp = Try-Run {
    (Invoke-RestMethod -Uri "https://api.ipify.org?format=json" -TimeoutSec 8).ip
} "Unavailable"

$winHttpProxy = Try-Run { (netsh winhttp show proxy) -join "`n" } "Unavailable"
$userProxy = Try-Run {
    Get-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings" |
        Select-Object ProxyEnable, ProxyServer, AutoConfigURL
} $null

$trace = $null
if (-not $SkipTrace) {
    $trace = Try-Run { (tracert -d -h 4 $TraceTarget) -join "`n" } "Trace failed or timed out"
}

$summary = [ordered]@{
    Timestamp = (Get-Date).ToString("s")
    PublicIp = $publicIp
    ActiveVpnAdapters = $activeVpnAdapters
    FullTunnelDetected = ($fullTunnelRoutes.Count -gt 0)
    FullTunnelRoutes = $fullTunnelRoutes
    DnsServers = $dns
    InterfaceMetrics = $interfaces
    Routes = $routes
    ConnectionProfiles = $profiles
    WinHttpProxy = $winHttpProxy
    UserProxy = $userProxy
    TraceTarget = if ($SkipTrace) { $null } else { $TraceTarget }
    Trace = $trace
}

Write-Section "Detected VPN adapters"
if ($vpnAdapters) {
    $vpnAdapters | Format-Table ifIndex, Name, InterfaceDescription, Status, LinkSpeed -AutoSize
} else {
    Write-Host "No VPN-like adapters found."
}

Write-Section "Routing summary"
if ($fullTunnelRoutes.Count -gt 0) {
    Write-Host "Full-tunnel routing appears to be active." -ForegroundColor Yellow
    $fullTunnelRoutes | Format-Table ifIndex, InterfaceAlias, DestinationPrefix, NextHop, RouteMetric -AutoSize
} else {
    Write-Host "No full-tunnel VPN route detected."
}

Write-Host ""
Write-Host "Most relevant routes:"
$routes |
    Where-Object {
        $_.DestinationPrefix -in @("0.0.0.0/0", "0.0.0.0/1", "128.0.0.0/1") -or
        ($activeVpnIndexes -contains $_.ifIndex)
    } |
    Format-Table ifIndex, InterfaceAlias, DestinationPrefix, NextHop, RouteMetric -AutoSize

Write-Section "DNS and interface priority"
$dns | Format-Table InterfaceIndex, InterfaceAlias, ServerAddresses -AutoSize
Write-Host ""
$interfaces | Format-Table ifIndex, InterfaceAlias, ConnectionState, InterfaceMetric, NlMtu -AutoSize

Write-Section "Public exit and proxy"
Write-Host "Public IP seen by websites: $publicIp"
Write-Host ""
Write-Host $winHttpProxy
Write-Host ""
if ($userProxy) {
    $userProxy | Format-List
}

if (-not $SkipTrace) {
    Write-Section "Short trace to $TraceTarget"
    Write-Host $trace
}

Write-Section "What this means"
if ($fullTunnelRoutes.Count -gt 0) {
    Write-Host "Your VPN is carrying general internet traffic, not just private/internal traffic."
    Write-Host "A script cannot reproduce that remote gateway, remote public IP, or private DNS access without an authorized tunnel/server."
    Write-Host "For speed, the approved fix is usually split tunneling: keep only company/private subnets on the VPN and leave normal internet traffic on local Wi-Fi."
} elseif ($activeVpnAdapters.Count -gt 0) {
    Write-Host "A VPN adapter is active, but this does not look like a full-tunnel setup from the IPv4 routes."
    Write-Host "If internal services work, DNS or specific private routes are probably the important pieces."
} else {
    Write-Host "No active VPN adapter was detected. Run again while connected to compare."
}

Write-Host ""
Write-Host "Speed-friendly, authorized options to ask IT/provider about:"
Write-Host "- Enable split tunneling for only required internal subnets/domains."
Write-Host "- Use a nearby VPN exit/server."
Write-Host "- Prefer WireGuard/UDP if your provider supports it."
Write-Host "- Avoid forcing public traffic through the VPN when policy allows."

if ($ExportJsonPath) {
    $summary | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $ExportJsonPath -Encoding UTF8
    Write-Host ""
    Write-Host "Exported JSON report to $ExportJsonPath"
}
