Add-Type @"
using System;
using System.Runtime.InteropServices;
public class WindowHelper {
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")] public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);
}
"@
# 查找并激活 Electron 窗口
$hwnd = [WindowHelper]::FindWindow($null, "文件管理系统")
if ($hwnd -ne [IntPtr]::Zero) {
    [WindowHelper]::ShowWindow($hwnd, 9)  # SW_RESTORE
    [WindowHelper]::SetForegroundWindow($hwnd)
    Write-Output "已激活Electron窗口: $hwnd"
} else {
    Write-Output "未找到Electron窗口"
}
Start-Sleep -Seconds 1
# 截图
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp = New-Object System.Drawing.Bitmap($screen.Width, $screen.Height)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen(0, 0, 0, 0, $bmp.Size)
$bmp.Save('F:\项目库\产品文件管理\screenshot7.png')
$g.Dispose()
$bmp.Dispose()
Write-Output '截图完成 screenshot7.png'