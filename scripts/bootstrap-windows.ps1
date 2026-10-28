param([Parameter(Mandatory=$true)][string]$ProductDir, [Parameter(Mandatory=$true)][string]$StatusFile)
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$utf8 = New-Object System.Text.UTF8Encoding($false)
# Read literal configuration values, never evaluate a shell script from .env.
$envFile = Join-Path $ProductDir '.env'
if (Test-Path -LiteralPath $envFile) {
    foreach ($line in [IO.File]::ReadAllLines($envFile)) {
        if ($line -match '^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$') {
            $name=$Matches[1]; $value=$Matches[2]
            if ($value.Length -ge 2 -and (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'")))) { $value=$value.Substring(1,$value.Length-2) }
            if (![Environment]::GetEnvironmentVariable($name,'Process')) { [Environment]::SetEnvironmentVariable($name,$value,'Process') }
        }
    }
}
$config = $env:READIFY_CONFIG_DIR
if (!$config) { $config=Join-Path $env:USERPROFILE '.config\prota' }
$runtime=Join-Path $config 'runtime'
[IO.Directory]::CreateDirectory($runtime) | Out-Null
function Write-State($step,$title,$detail,$state='preparing') {
    $json=@{step=$step;title=$title;detail=$detail;state=$state;show=$true} | ConvertTo-Json -Compress
    [IO.File]::WriteAllText("$StatusFile.next",$json,$utf8)
    Move-Item -LiteralPath "$StatusFile.next" -Destination $StatusFile -Force
}
function Download($url,$dest) {
    Write-Output ('Downloading ' + $url)
    for ($attempt=0; $attempt -lt 3; $attempt++) {
        try { Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $dest -TimeoutSec 600 -UserAgent 'Prota-Launcher' | Out-Null; return }
        catch { if ($attempt -eq 2) { throw }; Start-Sleep -Seconds 1 }
    }
}
$hash=[BitConverter]::ToString([Security.Cryptography.SHA256]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes([IO.Path]::GetFullPath($config)))).Replace('-','')
$mutex=New-Object Threading.Mutex($false, "Local\ProtaBootstrap-$hash")
$owned=$false
$stage=$null
try {
    try { $owned=$mutex.WaitOne(0) } catch [Threading.AbandonedMutexException] { $owned=$true }
    if (!$owned) { exit 0 }
    $node=Join-Path $runtime 'node\node.exe'
    if (!(Test-Path -LiteralPath $node) -and !$env:PROTA_MANAGED_NODE_ONLY) { $command=Get-Command node.exe -ErrorAction SilentlyContinue; if ($command) { $node=$command.Source } }
    $ready=$false
    if ($node -and (Test-Path -LiteralPath $node)) {
        $versionOutput=& $node --version
        $npm=Join-Path (Split-Path -Parent $node) 'node_modules\npm\bin\npm-cli.js'
        if ($LASTEXITCODE -eq 0 -and $versionOutput -match '^v(\d+)\.(\d+)\.') {
            $ready=([int]$Matches[1] -gt 22 -or ([int]$Matches[1] -eq 22 -and [int]$Matches[2] -ge 19)) -and (Test-Path -LiteralPath $npm)
        }
    }
    if (!$ready) {
        Write-State 1 '准备运行环境' '正在下载 Node.js，首次启动需要一些时间。'
        $arch=$env:PROCESSOR_ARCHITEW6432
        if (!$arch) { $arch=$env:PROCESSOR_ARCHITECTURE }
        if ($arch -eq 'ARM64') { $arch='arm64' } elseif ($arch -eq 'AMD64') { $arch='x64' } else { throw '需要 64 位 Windows。' }
        $stage=Join-Path $runtime ('node-download-'+[Guid]::NewGuid().ToString('N'))
        [IO.Directory]::CreateDirectory($stage) | Out-Null
        Download 'https://nodejs.org/dist/index.json' (Join-Path $stage 'index.json')
        $releases=Get-Content -LiteralPath (Join-Path $stage 'index.json') -Raw | ConvertFrom-Json
        $release=$releases | Where-Object { $_.lts -and [int]($_.version.TrimStart('v').Split('.')[0]) -ge 24 -and $_.files -contains "win-$arch-zip" } | Select-Object -First 1
        if (!$release) { throw '暂时没有适用的 Node.js 运行环境。' }
        $version=[string]$release.version
        if ($version -notmatch '^v[0-9]+\.[0-9]+\.[0-9]+$') { throw 'Node.js 版本信息无效。' }
        $archive="node-$version-win-$arch.zip"
        Download "https://nodejs.org/dist/$version/$archive" (Join-Path $stage $archive)
        Download "https://nodejs.org/dist/$version/SHASUMS256.txt" (Join-Path $stage 'checksums')
        $expected=$null
        foreach ($line in [IO.File]::ReadAllLines((Join-Path $stage 'checksums'))) {
            if ($line -match '^([a-fA-F0-9]{64})\s+\*?(.+)$' -and $Matches[2] -eq $archive) { $expected=$Matches[1] }
        }
        if (!$expected -or (Get-FileHash -LiteralPath (Join-Path $stage $archive) -Algorithm SHA256).Hash -ne $expected) { throw 'Node.js 下载校验未通过。' }
        Expand-Archive -LiteralPath (Join-Path $stage $archive) -DestinationPath $stage
        $destination=Join-Path $runtime 'node'
        if (Test-Path -LiteralPath $destination) { Move-Item -LiteralPath $destination -Destination (Join-Path $stage 'previous-node') }
        Move-Item -LiteralPath (Join-Path $stage "node-$version-win-$arch") -Destination $destination
        $node=Join-Path $destination 'node.exe'
    }
    $env:PATH=(Split-Path -Parent $node)+';'+$env:PATH
    $env:PYTHONUTF8='1'
    Set-Location -LiteralPath $ProductDir
    & $node (Join-Path $ProductDir 'scripts\desktop-launcher.mjs') $StatusFile
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} catch {
    Write-State 1 '准备未完成' ('请检查网络连接和产品文件夹写入权限，然后点击重试。已有项目与配置已保留。'+[Environment]::NewLine+$_.Exception.Message) 'error'
    exit 1
} finally {
    if ($stage -and (Test-Path -LiteralPath $stage)) { Remove-Item -LiteralPath $stage -Recurse -Force -ErrorAction SilentlyContinue }
    if ($owned) { $mutex.ReleaseMutex() }
    $mutex.Dispose()
}
