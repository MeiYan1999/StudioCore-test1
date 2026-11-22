!macro customUnInstall
  DeleteRegKey HKCU "Software\Classes\Directory\shell\StudioCoreDrive"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "vn.io.studiocore.drive"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "electron.app.StudioCore Drive"
!macroend
