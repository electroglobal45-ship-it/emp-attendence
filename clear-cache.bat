@echo off
echo ========================================
echo  Clear Next.js Build Cache
echo ========================================
echo.

echo Deleting .next folder...
if exist ".next" (
    rmdir /s /q ".next"
    echo ✓ .next folder deleted
) else (
    echo ! .next folder not found
)

echo.
echo Deleting node_modules/.cache...
if exist "node_modules\.cache" (
    rmdir /s /q "node_modules\.cache"
    echo ✓ node_modules/.cache deleted
) else (
    echo ! node_modules/.cache not found
)

echo.
echo ========================================
echo  Cache cleared successfully!
echo ========================================
echo.
echo You can now run: npm run dev
echo.
pause
