Add-Type @"
using System;
using System.Runtime.InteropServices;
public class KeyboardInput {
    [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, uint dwExtraInfo);
    public static void PressKey(byte vk) {
        keybd_event(vk, 0, 0, 0);
        System.Threading.Thread.Sleep(100);
        keybd_event(vk, 0, 2, 0);
        System.Threading.Thread.Sleep(200);
    }
}
"@
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
# 按两次下方向键从010移动到001
[KeyboardInput]::PressKey(0x28)  # 下方向键
Start-Sleep -Milliseconds 500
[KeyboardInput]::PressKey(0x28)  # 下方向键
Start-Sleep -Seconds 3
# 截图
$screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp = New-Object System.Drawing.Bitmap($screen.Width, $screen.Height)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen(0, 0, 0, 0, $bmp.Size)
$bmp.Save('F:\项目库\产品文件管理\screenshot10.png')
$g.Dispose()
$bmp.Dispose()
Write-Output 'done'