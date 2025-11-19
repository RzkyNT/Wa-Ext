@echo off
setlocal

REM Nama folder yang akan di-zip
set FOLDER=extension

REM Nama file output zip
set OUTPUT=extension.zip

echo ================================
echo   Compressing %FOLDER% ...
echo ================================

REM Hapus zip lama jika ada
if exist %OUTPUT% del %OUTPUT%

REM Proses zip
powershell -command "Compress-Archive -Path '%FOLDER%\*' -DestinationPath '%OUTPUT%' -Force"

echo.
echo Selesai! File zip: %OUTPUT%
pause

