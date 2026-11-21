param([string]$Kind)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName System.Windows.Forms
if ($Kind -eq 'video') {
  $dialog = New-Object System.Windows.Forms.OpenFileDialog
  $dialog.Filter = 'Video|*.mp4;*.mov;*.m4v;*.webm;*.mkv'
} else { $dialog = New-Object System.Windows.Forms.FolderBrowserDialog }
try {
  if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
    if ($Kind -eq 'video') { Write-Output $dialog.FileName } else { Write-Output $dialog.SelectedPath }
  }
} finally { $dialog.Dispose() }
