$ErrorActionPreference='Stop'
$base=Join-Path $env:RUNNER_TEMP "Prota 中文 user's folder"
$source=(Resolve-Path "$PSScriptRoot\..").Path
$product=Join-Path $base 'product'
New-Item -ItemType Directory -Path $product -Force | Out-Null
# Copy the committed product only, never developer caches or business data.
$archive=Join-Path $env:RUNNER_TEMP 'prota-product.zip'
& git -C $source archive --format=zip -o $archive HEAD
if ($LASTEXITCODE) { throw 'git archive failed' }
Expand-Archive -LiteralPath $archive -DestinationPath $product
$env:READIFY_CONFIG_DIR=Join-Path $base 'config'
$env:READIFY_PORT='18080'; $env:READIFY_AGENT_PORT='18081'
$env:PROTA_NO_OPEN='1'; $env:PROTA_MANAGED_NODE_ONLY='1'
Remove-Item Env:READIFY_WORKSPACE -ErrorAction SilentlyContinue
$cache=Join-Path $env:LOCALAPPDATA 'Prota'
function Launch-And-Wait($cold) {
    $seen=New-Object 'Collections.Generic.HashSet[int]'
    $visible=$false
    $started=Get-Date
    $app=Start-Process -FilePath (Join-Path $product 'Prota.exe') -PassThru
    $null=$app.Handle
    while (!$app.HasExited) {
        if (((Get-Date)-$started).TotalMinutes -gt 15) { throw 'Desktop launch timed out' }
        foreach ($file in @(Get-ChildItem -LiteralPath $cache -Filter 'launch-*.json' -ErrorAction SilentlyContinue)) {
            try {
                $state=[IO.File]::ReadAllText($file.FullName) | ConvertFrom-Json
                if ($state.show) { $visible=$true; [void]$seen.Add([int]$state.step) }
                if ($state.state -eq 'error') { throw $state.detail }
            } catch [ArgumentException] { }
        }
        Start-Sleep -Milliseconds 100
        $app.Refresh()
    }
    $app.WaitForExit()
    if ($app.ExitCode -ne 0) { throw 'Desktop entry failed' }
    if ($cold -and (!$seen.Contains(1) -or !$seen.Contains(2) -or !$seen.Contains(3))) { throw "Missing preparation steps: $seen" }
    if (!$cold -and $visible) { throw 'Healthy launch unexpectedly showed preparation UI' }
    $bridge=Invoke-RestMethod 'http://127.0.0.1:18080/api/product/health'
    $agent=Invoke-RestMethod 'http://127.0.0.1:18081/api/agent/health'
    if (!$bridge.installation -or $bridge.installation -ne $agent.installation) { throw 'Services did not launch from the same installation' }
    Write-Output "Desktop launch succeeded (cold=$cold, steps=$seen)."
}
try {
    Launch-And-Wait $true
    $before=(Get-Item -LiteralPath (Join-Path $product 'node_modules\.prota-vercel\node_modules\vercel\package.json')).LastWriteTimeUtc
    $projects=Join-Path $env:READIFY_CONFIG_DIR 'workspace\data\projects.json'
    $hash=(Get-FileHash -LiteralPath $projects).Hash
    Launch-And-Wait $false
    if ((Get-FileHash -LiteralPath $projects).Hash -ne $hash) { throw 'Warm launch altered project metadata' }
    if ((Get-Item -LiteralPath (Join-Path $product 'node_modules\.prota-vercel\node_modules\vercel\package.json')).LastWriteTimeUtc -ne $before) { throw 'Warm launch reinstalled Vercel' }
    $node=Join-Path $env:READIFY_CONFIG_DIR 'runtime\node\node.exe'
    & $node --test (Join-Path $product 'tests\desktop-launcher.test.mjs') (Join-Path $product 'tests\vercel-cli.test.mjs')
    if ($LASTEXITCODE) { throw 'Node regression tests failed' }
    $python=Join-Path $env:READIFY_CONFIG_DIR 'runtime\python\python.exe'
    Push-Location $product
    try {
        & $python -m unittest discover -s tests -p test_windows_runtime.py
        if ($LASTEXITCODE) { throw 'Windows process liveness failed' }
    } finally { Pop-Location }
    # Occupied unrelated ports must never be terminated by the launcher helper.
    [IO.File]::WriteAllText((Join-Path $base 'listener.cjs'), 'require("net").createServer().listen(18082,"127.0.0.1")')
    $unrelated=Start-Process $node -ArgumentList ('"'+(Join-Path $base 'listener.cjs')+'"') -PassThru -WindowStyle Hidden
    try {
        Start-Sleep -Seconds 1
        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $product 'scripts\windows-ports.ps1') 18082 (Join-Path $product 'server\agent-server.mjs') 2>$null
        if ($LASTEXITCODE -eq 0) { throw 'Unrelated listener was accepted as owned' }
        if ($unrelated.HasExited) { throw 'Unrelated listener was terminated' }
    } finally { Stop-Process -Id $unrelated.Id -ErrorAction SilentlyContinue }
} finally {
    foreach ($port in @(18080,18081)) {
        Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue }
    }
    if (Test-Path $cache) { Copy-Item -LiteralPath $cache -Destination (Join-Path $env:RUNNER_TEMP 'prota-test-logs') -Recurse -Force }
    if (Test-Path (Join-Path $product 'logs')) { Copy-Item -LiteralPath (Join-Path $product 'logs') -Destination (Join-Path $env:RUNNER_TEMP 'prota-service-logs') -Recurse -Force }
}
