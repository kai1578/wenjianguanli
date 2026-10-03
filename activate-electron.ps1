Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32B {
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
"@
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
# 激活 "文件管理系统" 窗口 (handle 198222)
$hwnd = [IntPtr]198222
[Win32B]::ShowWindow($hwnd, 9)
[Win32B]::SetForegroundWindow($hwnd)
Start-Sleep -Seconds 2
# 截图
$screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp = New-Object System.Drawing.Bitmap($screen.Width, $screen.Height)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen(0, 0, 0, 0, $bmp.Size)
$bmp.Save('F:\项目库\产品文件管理\screenshot8.png')
$g.Dispose()
$bmp.Dispose()
Write-Output 'done'