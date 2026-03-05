@echo off
echo ===================================================
echo   SAT Mobile - Email Function Deployment Helper
echo ===================================================
echo.
echo This script will help you deploy the email notifications.
echo.

:ASK_PROVIDER
echo Which email provider are you using?
echo 1. Resend (Recommended)
echo 2. SendGrid
echo 3. Skip secret setup (Validation only)
set /p provider="Enter 1, 2, or 3: "

if "%provider%"=="1" goto RESEND
if "%provider%"=="2" goto SENDGRID
if "%provider%"=="3" goto DEPLOY
goto ASK_PROVIDER

:RESEND
echo.
set /p apikey="Enter your Resend API Key: "
if "%apikey%"=="" goto RESEND
echo Setting RESEND_API_KEY...
call firebase functions:secrets:set RESEND_API_KEY --data-string "%apikey%"
goto DEPLOY

:SENDGRID
echo.
set /p apikey="Enter your SendGrid API Key: "
if "%apikey%"=="" goto SENDGRID
echo Setting SENDGRID_API_KEY...
call firebase functions:secrets:set SENDGRID_API_KEY --data-string "%apikey%"
goto DEPLOY

:DEPLOY
echo.
echo Deploying Cloud Functions...
echo (This may take a few minutes)
echo.
cd functions
call npm install
cd ..
call firebase deploy --only functions

echo.
echo ===================================================
echo   Deployment Complete!
echo ===================================================
echo.
pause
