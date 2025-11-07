@echo off
REM =====================================================
REM File: rename_jpg_lower.bat
REM Fungsi: Ubah semua file .JPG menjadi .jpg (case lowercase)
REM Penulis: Dian Yanzen
REM =====================================================

echo Merenaming semua file .JPG menjadi .jpg ...
for /r %%a in (*.JPG) do (
    ren "%%a" "%%~na.jpg"
)
echo Selesai!
pause