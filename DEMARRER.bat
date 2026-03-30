@echo off
echo.
echo  ==========================================
echo   LHMA - Ligue de Hockey - Demarrage
echo  ==========================================
echo.

cd /d "%~dp0"

echo [1/2] Demarrage du serveur backend...
start "Backend - Hockey" cmd /k "cd backend && node server.js"

timeout /t 2 /nobreak >nul

echo [2/2] Demarrage du frontend React...
start "Frontend - Hockey" cmd /k "cd frontend && npm run dev"

timeout /t 3 /nobreak >nul

echo.
echo  ==========================================
echo   Application disponible sur:
echo   http://localhost:5173
echo.
echo   Comptes de demo:
echo   admin / password123       (Admin complet)
echo   cap_rangers / password123    (Capitaine Rangers)
echo   joueur_rangers / password123 (Joueur Rangers)
echo  ==========================================
echo.

start http://localhost:5173
