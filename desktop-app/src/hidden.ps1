param([Parameter(Mandatory=$true)][string]$RootPath)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$paths = @(Get-ChildItem -LiteralPath $RootPath -Force -Recurse -ErrorAction Stop |
  Where-Object { ($_.Attributes -band [IO.FileAttributes]::Hidden) -or ($_.Attributes -band [IO.FileAttributes]::System) } |
  ForEach-Object { $_.FullName })
ConvertTo-Json -InputObject $paths -Compress
