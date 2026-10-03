Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class MouseInput4 {
    [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
    [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, int dx, int dy, uint cButtons, uint dwExtraInfo);
    [DllImport("user32.dll")] public static extern short VkKeyScan(char ch);
    [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, uint dwExtraInfo);
    public static void Click(int x, int y) {
        SetCursorPos(x, y);
        System.Threading.Thread.Sleep(300);
        mouse_event(0x0002, 0, 0, 0, 0);
        System.Threading.Thread.Sleep(100);
        mouse_event(0x0004, 0, 0, 0, 0);
    }
    public static void TypeText(string text) {
        foreach (char c in text) {
            short vk = VkKeyScan(c);
            byte bVk = (byte)(vk & 0xFF);
            keybd_event(bVk, 0, 0, 0);
            System.Threading.Thread.Sleep(50);
            keybd_event(bVk, 0, 2, 0);
            System.Threading.Thread.Sleep(50);
        }
    }
    public static void PressEnter() {
        keybd_event(0x0D, 0, 0, 0);
        System.Threading.Thread.Sleep(100);
        keybd_event(0x0D, 0, 2, 0);
    }
}
"@
# 1. 点击搜索框（约 150, 230）
[MouseInput4]::Click(150, 230)
Start-Sleep -Milliseconds 500
# 2. 输入 "001"
[MouseInput4]::TypeText("001")
Start-Sleep -Seconds 2
# 3. 截图（搜索结果）
$screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp = New-Object System.Drawing.Bitmap($screen.Width, $screen.Height)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen(0, 0, 0, 0, $bmp.Size)
$bmp.Save('F:\项目库\产品文件管理\screenshot6.png')
$g.Dispose()
$bmp.Dispose()
Write-Output '搜索完成，已截图 screenshot6.png'