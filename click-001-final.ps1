Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class MouseInput5 {
    [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
    [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, int dx, int dy, uint cButtons, uint dwExtraInfo);
    public static void Click(int x, int y) {
        SetCursorPos(x, y);
        System.Threading.Thread.Sleep(300);
        mouse_event(0x0002, 0, 0, 0, 0);
        System.Threading.Thread.Sleep(100);
        mouse_event(0x0004, 0, 0, 0, 0);
    }
}
"@
# 点击 001 PDF 文件（坐标约 90, 495）
[MouseInput5]::Click(90, 495)
Start-Sleep -Seconds 3
# 截图
$screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp = New-Object System.Drawing.Bitmap($screen.Width, $screen.Height)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen(0, 0, 0, 0, $bmp.Size)
$bmp.Save('F:\项目库\产品文件管理\screenshot9.png')
$g.Dispose()
$bmp.Dispose()
Write-Output 'done'