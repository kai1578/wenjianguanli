Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class Win32 {
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
    [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll")] public static extern int GetWindowTextLength(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
    public static string GetTitle(IntPtr hWnd) {
        int len = GetWindowTextLength(hWnd);
        if (len <= 0) return "";
        StringBuilder sb = new StringBuilder(len + 1);
        GetWindowText(hWnd, sb, sb.Capacity);
        return sb.ToString();
    }
}
"@
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# 列出所有可见窗口
$windows = [System.Collections.ArrayList]::new()
$proc = [Win32+EnumWindowsProc]{
    param($hWnd, $lParam)
    if ([Win32]::IsWindowVisible($hWnd)) {
        $title = [Win32]::GetTitle($hWnd)
        if ($title -and $title.Length -gt 0) {
            $null = $windows.Add([PSCustomObject]@{ Handle = $hWnd; Title = $title })
        }
    }
    return $true
}
[Win32]::EnumWindows($proc, [IntPtr]::Zero)
$windows | ForEach-Object { Write-Output ("  " + $_.Handle + " : " + $_.Title) }

# 查找包含"文件"或"产品"的窗口
$target = $windows | Where-Object { $_.Title -match "文件|产品|electron" } | Select-Object -First 1
if ($target) {
    [Win32]::ShowWindow($target.Handle, 9)
    [Win32]::SetForegroundWindow($target.Handle)
    Write-Output ("已激活窗口: " + $target.Title)
    Start-Sleep -Seconds 2
    # 截图
    $screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
    $bmp = New-Object System.Drawing.Bitmap($screen.Width, $screen.Height)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.CopyFromScreen(0, 0, 0, 0, $bmp.Size)
    $bmp.Save('F:\项目库\产品文件管理\screenshot7.png')
    $g.Dispose()
    $bmp.Dispose()
    Write-Output '截图完成'
} else {
    Write-Output '未找到目标窗口'
}