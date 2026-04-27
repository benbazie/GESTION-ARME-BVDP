param(
  [string]$ReleaseDir = "release\win-unpacked",
  [string]$OutputJs  = "release-inspection.js"
)

$ErrorActionPreference = "Stop"
$script:results = @()
$script:asarEntries = @()

function Report([string]$label, [string]$path) {
  if (Test-Path $path) {
    $item = Get-Item $path
    $size = if ($item -is [System.IO.DirectoryInfo]) {
      (Get-ChildItem $path -Recurse -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum
    } else {
      $item.Length
    }
    Write-Host "[OK] $label ($size)" -ForegroundColor Green
    $script:results += [pscustomobject]@{
      label   = $label
      path    = $path
      present = $true
      size    = $size
    }
  } else {
    Write-Host "[KO] $label manquant ($path)" -ForegroundColor Red
    $script:results += [pscustomobject]@{
      label   = $label
      path    = $path
      present = $false
      size    = $null
    }
  }
}

$root = Split-Path -Parent $MyInvocation.MyCommand.Definition
try {
  $project = (Resolve-Path (Join-Path $root "..")).Path
} catch {
  Write-Host "Projet introuvable sous $root" -ForegroundColor Red
  exit 1
}
try {
  $release = (Resolve-Path (Join-Path $project $ReleaseDir)).Path
} catch {
  Write-Host "Release introuvable : $ReleaseDir" -ForegroundColor Red
  exit 2
}

Write-Host "Inspection : $release`n"

Report -label "resources\app.asar"              -path (Join-Path $release "resources\app.asar")
Report -label "resources\dist"                  -path (Join-Path $release "resources\dist")
Report -label "resources\utils"                 -path (Join-Path $release "resources\utils")
Report -label "resources\.env"                  -path (Join-Path $release "resources\.env")
Report -label ".env racine release"            -path (Join-Path $release ".env")

try {
  if (Get-Command npx -ErrorAction SilentlyContinue) {
    $asar = Join-Path $release "resources\app.asar"
    if (Test-Path $asar) {
      Write-Host "`nListe app.asar :" -ForegroundColor Cyan
      $list = & npx asar list $asar 2>&1
      $script:asarEntries = ($list | Where-Object { $_ -is [string] -and $_.Trim().Length }) -as [string[]]
      $script:asarEntries | ForEach-Object { Write-Host $_ }
    }
  }
} catch {
  Write-Host "Impossible d'utiliser npx asar (non installé ?)" -ForegroundColor Yellow
}

$jsTarget = if ([System.IO.Path]::IsPathRooted($OutputJs)) { $OutputJs } else { Join-Path $project $OutputJs }

$resultObject = [pscustomobject]@{
  releasePath = $release
  generatedAt = (Get-Date).ToString("s")
  items       = $script:results
  appAsarList = $script:asarEntries
}

$json = $resultObject | ConvertTo-Json -Depth 6
$jsContent = "export const releaseInspection = $json;`n"
Set-Content -Path $jsTarget -Value $jsContent -Encoding UTF8
Write-Host "`nRapport JS généré : $jsTarget" -ForegroundColor Cyan
