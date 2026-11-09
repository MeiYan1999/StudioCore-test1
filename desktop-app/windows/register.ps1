# ====================================================================
# StudioCore Drive — Đăng ký Context Menu vào Windows Registry (Unicode)
# ====================================================================
param (
    [string]$AppDir = "$env:USERPROFILE\.studiocore-drive\app"
)

$shareBat = "$AppDir\windows\share-folder.bat"
$guiBat   = "$AppDir\windows\open-gui.bat"

# Root path in HKCU (No Administrator privileges required)
$baseHKCU = "HKCU:\Software\Classes"

# Function to create or update key with properties
function Set-RegItem {
    param (
        [string]$Path,
        [string]$Name = "",
        [string]$Value = ""
    )
    if (-not (Test-Path $Path)) {
        New-Item -Path $Path -Force | Out-Null
    }
    if ($Name -ne "") {
        Set-ItemProperty -Path $Path -Name $Name -Value $Value -Force | Out-Null
    } else {
        Set-ItemProperty -Path $Path -Name "(default)" -Value $Value -Force | Out-Null
    }
}

Write-Host "Đang đăng ký menu chuột phải StudioCore Drive..." -ForegroundColor Cyan

# 1. Menu trên Thư mục (Directory)
$dirMenu = "$baseHKCU\Directory\shell\StudioCoreDrive"
Set-RegItem -Path $dirMenu -Name "MUIVerb" -Value "StudioCore Drive"
Set-RegItem -Path $dirMenu -Name "SubCommands" -Value ""
Set-RegItem -Path $dirMenu -Name "Icon" -Value "imageres.dll,-1001"

# cmd1: Album
Set-RegItem -Path "$dirMenu\shell\cmd1" -Name "MUIVerb" -Value "Tạo link Album (chọn ảnh duyệt)"
Set-RegItem -Path "$dirMenu\shell\cmd1\command" -Value "cmd.exe /c `"`"$shareBat`" `"%1`" album`""

# cmd2: Folder
Set-RegItem -Path "$dirMenu\shell\cmd2" -Name "MUIVerb" -Value "Tạo link Thư mục (xem & tải .zip)"
Set-RegItem -Path "$dirMenu\shell\cmd2\command" -Value "cmd.exe /c `"`"$shareBat`" `"%1`" folder`""

# cmd3: GUI
Set-RegItem -Path "$dirMenu\shell\cmd3" -Name "MUIVerb" -Value "Mở bảng điều khiển StudioCore Drive"
Set-RegItem -Path "$dirMenu\shell\cmd3\command" -Value "cmd.exe /c `"`"$guiBat`"`""

# 2. Menu trên Background Thư mục (khoảng trắng bên trong thư mục)
$bgMenu = "$baseHKCU\Directory\Background\shell\StudioCoreDrive"
Set-RegItem -Path $bgMenu -Name "MUIVerb" -Value "StudioCore Drive"
Set-RegItem -Path $bgMenu -Name "SubCommands" -Value ""
Set-RegItem -Path $bgMenu -Name "Icon" -Value "imageres.dll,-1001"

Set-RegItem -Path "$bgMenu\shell\cmd1" -Name "MUIVerb" -Value "Tạo link Album (chọn ảnh duyệt)"
Set-RegItem -Path "$bgMenu\shell\cmd1\command" -Value "cmd.exe /c `"`"$shareBat`" `"%V`" album`""

Set-RegItem -Path "$bgMenu\shell\cmd2" -Name "MUIVerb" -Value "Tạo link Thư mục (xem & tải .zip)"
Set-RegItem -Path "$bgMenu\shell\cmd2\command" -Value "cmd.exe /c `"`"$shareBat`" `"%V`" folder`""

Set-RegItem -Path "$bgMenu\shell\cmd3" -Name "MUIVerb" -Value "Mở bảng điều khiển StudioCore Drive"
Set-RegItem -Path "$bgMenu\shell\cmd3\command" -Value "cmd.exe /c `"`"$guiBat`"`""

# 3. Menu trên file Video .mp4 & .mov
$mp4Menu = "$baseHKCU\SystemFileAssociations\.mp4\shell\StudioCoreDriveVideo"
Set-RegItem -Path $mp4Menu -Name "MUIVerb" -Value "StudioCore Drive: Tạo link Video (góp ý theo giây)"
Set-RegItem -Path "$mp4Menu\command" -Value "cmd.exe /c `"`"$shareBat`" `"%1`" video`""

$movMenu = "$baseHKCU\SystemFileAssociations\.mov\shell\StudioCoreDriveVideo"
Set-RegItem -Path $movMenu -Name "MUIVerb" -Value "StudioCore Drive: Tạo link Video (góp ý theo giây)"
Set-RegItem -Path "$movMenu\command" -Value "cmd.exe /c `"`"$shareBat`" `"%1`" video`""

Write-Host "✅ Đã đăng ký thành công Context Menu vào Windows Explorer!" -ForegroundColor Green
