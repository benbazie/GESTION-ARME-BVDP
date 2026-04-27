:: filepath: d:\gestion-armes-vdp-Copie\scripts\run-web-ui.cmd
@echo off
setlocal

cd /d "%~dp0.."
set "PROJECT_DIR=%cd%"

echo [Gestion Armes VDP] Initialisation

if not exist "node_modules" (
  echo [Gestion Armes VDP] Installation des dependances (internet requis)
  call npm.cmd install --omit=dev
  if errorlevel 1 goto fail
)

echo [Gestion Armes VDP] Demarrage de l'API (console separee)
start "Gestion Armes VDP - API" cmd /c "cd /d ""%PROJECT_DIR%"" && call npm.cmd run server"

echo [Gestion Armes VDP] Attente du service...
ping 127.0.0.1 -n 6 >nul

echo [Gestion Armes VDP] Ouverture du navigateur sur http://localhost:3001/
start "" http://localhost:3001/

echo [Gestion Armes VDP] Pret.
exit /b 0

:fail
echo [Gestion Armes VDP] Echec : verifier Node.js, npm et la connexion internet.
pause
exit /b 1