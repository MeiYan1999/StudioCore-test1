# ====================================================================
# StudioCore Drive — Gỡ bỏ Context Menu khỏi Windows Registry
# ====================================================================
$baseHKCU = "HKCU:\Software\Classes"

function Remove-RegItemSafely {
    param ([string]$Path)
    if (Test-Path $Path) {
        Remove-Item -Path $Path -Recurse -Force -ErrorAction SilentlyContinue
    }
}

Remove-RegItemSafely "$baseHKCU\Directory\shell\StudioCoreDrive"
Remove-RegItemSafely "$baseHKCU\Directory\Background\shell\StudioCoreDrive"
Remove-RegItemSafely "$baseHKCU\SystemFileAssociations\.mp4\shell\StudioCoreDriveVideo"
Remove-RegItemSafely "$baseHKCU\SystemFileAssociations\.mov\shell\StudioCoreDriveVideo"

Write-Host "✅ Đã gỡ bỏ Context Menu StudioCore Drive thành công!" -ForegroundColor Green
