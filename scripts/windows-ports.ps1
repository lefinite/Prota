param([int]$Port, [string]$Entry)
$ErrorActionPreference = 'Stop'
$connections = @(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)
foreach ($owner in @($connections.OwningProcess | Select-Object -Unique)) {
    $process = Get-CimInstance Win32_Process -Filter "ProcessId=$owner"
    # Services are launched with an absolute entry path. Never stop unrelated listeners.
    if (!$process -or !$process.CommandLine -or $process.CommandLine.IndexOf($Entry, [StringComparison]::OrdinalIgnoreCase) -lt 0) {
        throw "Port $Port belongs to another application."
    }
    Stop-Process -Id $owner -ErrorAction Stop
}
for ($i=0; $i -lt 30; $i++) {
    if (!(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)) { exit 0 }
    Start-Sleep -Milliseconds 100
}
throw 'The previous Prota service has not exited.'
