// Prota's dependency-free Windows GUI entry. Build with scripts/build-windows-launcher.py.
package main

import (
    "os"
    "os/exec"
    "path/filepath"
    "syscall"
    "unsafe"
)

func message(text string) {
    title, _ := syscall.UTF16PtrFromString("Prota")
    body, _ := syscall.UTF16PtrFromString(text)
    syscall.NewLazyDLL("user32.dll").NewProc("MessageBoxW").Call(0, uintptr(unsafe.Pointer(body)), uintptr(unsafe.Pointer(title)), 0x10)
}

func main() {
    exe, err := os.Executable()
    if err != nil { message("无法定位 Prota，请重新解压完整产品文件夹。"); return }
    root := filepath.Dir(exe)
    script := filepath.Join(root, "scripts", "launcher-windows.ps1")
    if _, err = os.Stat(script); err != nil { message("请将 Prota.exe 和 scripts、server 等目录一起保留，解压完整产品文件夹后再打开。"); return }
    ps := filepath.Join(os.Getenv("SystemRoot"), "System32", "WindowsPowerShell", "v1.0", "powershell.exe")
    cmd := exec.Command(ps, "-NoProfile", "-STA", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden", "-File", script, root)
    cmd.Dir = root
    cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x08000000}
    if err = cmd.Run(); err != nil { message("Prota 启动器未能运行。请检查产品文件是否完整，以及系统是否允许本产品运行。无需安装或打开终端。"); os.Exit(1) }
}
