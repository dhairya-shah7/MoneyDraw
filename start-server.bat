@echo off
title MoneyDraw Withdrawal Server (0.0.0.0:3001)
echo ===================================================
echo   MoneyDraw Banking, UPI Cash & Withdrawal Server
echo ===================================================
echo.
echo Starting MoneyDraw Server on 0.0.0.0:3001...
echo.
echo - Local Desktop Access: http://localhost:3001
echo - Network / Mobile Access: http://192.168.29.248:3001
echo.
echo Press Ctrl+C to stop the server at any time.
echo ===================================================
echo.

npm run dev
pause
