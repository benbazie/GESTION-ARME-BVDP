# Télécharge et installe Visual Studio Build Tools (workload C++). Exécuter en tant qu'administrateur.

[CmdletBinding()]
param(
  [string] $Url = 'https://aka.ms/vs/17/release/vs_BuildTools.exe',
  [string] $Workloads = 'Microsoft.VisualStudio.Workload.VCTools', # workload principal (C++ build tools)
  [string[]] $OptionalComponents = @(
    'Microsoft.VisualStudio.Component.VC.Tools.x86.x64',        # MSVC toolset
    'Microsoft.VisualStudio.Component.Windows10SDK.19041',      # Windows 10 SDK (ajuster si nécessaire)
    'Microsoft.VisualStudio.Component.VC.CMake.Tools'           # CMake support
  ),
  [string] $InstallerName = 'vs_buildtools.exe'
)

function Is-Admin {
  $id = [Security.Principal.WindowsIdentity]::GetCurrent()
  (New-Object Security.Principal.WindowsPrincipal($id)).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Is-Admin)) {
  Write-Error "Ce script doit être exécuté depuis PowerShell en mode administrateur."
  exit 1
}

$dest = Join-Path $env:TEMP $InstallerName
Write-Output "Téléchargement de $Url → $dest ..."
try {
  Invoke-WebRequest -Uri $Url -OutFile $dest -UseBasicParsing -TimeoutSec 300
} catch {
  Write-Error "Échec du téléchargement : $($_.Exception.Message)"
  exit 2
}

# Construit les arguments d'installation (workload + composants optionnels)
$addArgs = "--add $Workloads"
if ($OptionalComponents.Count -gt 0) {
  $addArgs += " --add " + ($OptionalComponents -join " --add ")
}
$commonArgs = "--includeRecommended --quiet --wait --norestart --nocache"
$arguments = "$addArgs $commonArgs"

Write-Output "Lancement de l'installateur (silencieux). Cela peut prendre plusieurs minutes..."
$proc = Start-Process -FilePath $dest -ArgumentList $arguments -NoNewWindow -Wait -PassThru

if ($proc.ExitCode -eq 0) {
  Write-Output "Installation terminée avec succès. Redémarrez la machine si demandé."
  Write-Output "Vérifiez ensuite dans PowerShell (admin) : where cl  et  cl.exe /?"
  exit 0
} else {
  Write-Warning "L'installateur a retourné le code de sortie $($proc.ExitCode)."
  Write-Warning "Si échec, relancer manuellement l'installateur graphique :"
  Write-Warning "`"$dest`""
  exit $proc.ExitCode
}
