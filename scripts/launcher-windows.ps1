param([Parameter(Mandatory=$true)][string]$ProductDir)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class ProtaLauncherWindow {
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr handle, int command);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr handle);
}
'@
[Windows.Forms.Application]::EnableVisualStyles()
$cache=Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'Prota'
[IO.Directory]::CreateDirectory($cache) | Out-Null
$statusFile=Join-Path $cache ('launch-'+[Guid]::NewGuid().ToString('N')+'.json')
$log=Join-Path $cache 'launcher.log'
$form=New-Object Windows.Forms.Form
$form.Text='Prota'; $form.ClientSize=New-Object Drawing.Size(520,230)
$form.StartPosition='CenterScreen'; $form.FormBorderStyle='FixedDialog'; $form.MaximizeBox=$false; $form.MinimizeBox=$false; $form.ControlBox=$false
$icon=Join-Path $ProductDir 'portal\assets\prota\app-icon.ico'
if (Test-Path -LiteralPath $icon) { $form.Icon=New-Object Drawing.Icon($icon) }
$title=New-Object Windows.Forms.Label
$title.SetBounds(28,24,464,34); $title.Font=New-Object Drawing.Font('Microsoft YaHei UI',16,[Drawing.FontStyle]::Bold)
$detail=New-Object Windows.Forms.Label
$detail.SetBounds(28,68,464,65); $detail.Font=New-Object Drawing.Font('Microsoft YaHei UI',10)
$progress=New-Object Windows.Forms.ProgressBar
$progress.SetBounds(28,148,464,8); $progress.Style='Marquee'
$steps=New-Object Windows.Forms.Label
$steps.SetBounds(28,175,464,32); $steps.Font=New-Object Drawing.Font('Microsoft YaHei UI',9)
$form.Controls.AddRange(@($title,$detail,$progress,$steps))
try {
    do {
        Remove-Item -LiteralPath $statusFile -ErrorAction SilentlyContinue
        # Paths are passed as arguments, never evaluated as PowerShell source.
        $info=New-Object Diagnostics.ProcessStartInfo
        $info.FileName=Join-Path $PSHOME 'powershell.exe'
        $worker=Join-Path $ProductDir 'scripts\bootstrap-windows.ps1'
        $info.Arguments='-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File "'+$worker+'" "'+$ProductDir.TrimEnd('\')+'" "'+$statusFile+'"'
        $info.UseShellExecute=$false; $info.CreateNoWindow=$true
        $info.RedirectStandardOutput=$true; $info.RedirectStandardError=$true
        # The worker's output is redirected to separate files to avoid pipe deadlocks during npm install.
        $outLog=Join-Path $cache 'launcher-output.log'; $errLog=Join-Path $cache 'launcher-error.log'
        $process=Start-Process -FilePath $info.FileName -ArgumentList $info.Arguments -WindowStyle Hidden -PassThru -RedirectStandardOutput $outLog -RedirectStandardError $errLog
        $null=$process.Handle
        $failure=$null
        $windowRecorded=$false
        while (!$process.HasExited) {
            if (Test-Path -LiteralPath $statusFile) {
                try {
                    $state=[IO.File]::ReadAllText($statusFile) | ConvertFrom-Json
                    if ($state.show) {
                        $title.Text=$state.title; $detail.Text=$state.detail
                        $steps.Text='第 '+$state.step+'/4 步 · 运行环境 → Python → 产品依赖 → 工作台'
                        if (!$form.Visible) { $form.Show() }
                        if (![ProtaLauncherWindow]::IsWindowVisible($form.Handle)) { [void][ProtaLauncherWindow]::ShowWindow($form.Handle,5) }
                        if (!$windowRecorded -and [ProtaLauncherWindow]::IsWindowVisible($form.Handle)) {
                            $form.Activate(); $windowRecorded=$true
                            if ($env:PROTA_LAUNCHER_TEST_UI -eq '1') {
                                [IO.File]::WriteAllText($statusFile+'.ui','visible')
                                $form.Refresh()
                                $image=New-Object Drawing.Bitmap($form.Width,$form.Height)
                                try { $form.DrawToBitmap($image,(New-Object Drawing.Rectangle(0,0,$form.Width,$form.Height))); $image.Save((Join-Path $cache 'preparation.png')) } finally { $image.Dispose() }
                            }
                        }
                    }
                    if ($state.state -eq 'error') { $failure=$state.detail }
                } catch { }
            }
            [Windows.Forms.Application]::DoEvents()
            Start-Sleep -Milliseconds 150
            $process.Refresh()
        }
        $process.WaitForExit()
        # Capture a final error even if the process failed between timer ticks.
        if (Test-Path -LiteralPath $statusFile) {
            try { $state=[IO.File]::ReadAllText($statusFile) | ConvertFrom-Json; if ($state.state -eq 'error') { $failure=$state.detail } } catch { }
        }
        $exitCode=$process.ExitCode; $process.Dispose()
        $form.Hide()
        if ($exitCode -eq 0 -and !$failure) { break }
        if (!$failure) { $failure='请检查网络连接和产品文件夹写入权限后重试。' }
        [IO.File]::WriteAllText($log, $failure+[Environment]::NewLine+'Output: '+$outLog+[Environment]::NewLine+'Errors: '+$errLog)
        $choice=[Windows.Forms.MessageBox]::Show($failure+"`n`n诊断日志："+$log,'Prota 暂时无法启动','RetryCancel','Error')
    } while ($choice -eq [Windows.Forms.DialogResult]::Retry)
} finally {
    $form.Dispose()
    Remove-Item -LiteralPath $statusFile -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath ($statusFile+'.ui') -ErrorAction SilentlyContinue
}
