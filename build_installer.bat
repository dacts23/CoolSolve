@echo off
setlocal
cd /d "%~dp0"

:: ============================================================
:: CoolSolve Windows Build + Installer Script
::
:: Auto-detects:
::   - Git (on PATH)
::   - Node.js & npm (for GUI frontend build)
::   - Python 3 (WinPython, Anaconda, python.org, or on PATH)
::   - CMake (standalone or bundled in Visual Studio)
::   - Visual Studio 2022 / C++ Build Tools (if compiling from source)
::   - NSIS makensis (for Windows installer creation)
:: ============================================================

:: --- Section 1: Configuration & Defaults ---
set "PROJECT_DIR=%~dp0"
if "%PROJECT_DIR:~-1%"=="\" set "PROJECT_DIR=%PROJECT_DIR:~0,-1%"

if not defined LIBRARY_TAG set "LIBRARY_TAG=main"

:: Auto-locate Python 3
call :find_python
if errorlevel 1 (
    echo.
    echo ERROR: Python 3 interpreter was not found.
    echo Install Python from https://www.python.org or via:
    echo   winget install Python.Python.3.12
    pause
    exit /b 1
)

:: Auto-locate CMake
call :find_cmake

:: Auto-locate NSIS
call :find_nsis

:: --- Section 2: Environment verification ---
echo [1/5] Verifying environment...
echo        Python:   "%PYTHON_EXE%"
if defined CMAKE_EXE (
    echo        CMake:    "%CMAKE_EXE%"
) else (
    echo        CMake:    [Not found - will use existing binary if available]
)
if defined MAKENSIS_EXE (
    echo        NSIS:     "%MAKENSIS_EXE%"
) else (
    echo        NSIS:     [Not found]
)

where git >nul 2>&1
if errorlevel 1 (
    echo.
    echo ERROR: git was not found on PATH. Install Git for Windows
    echo   ^(https://git-scm.com/download/win^) or run: winget install Git.Git
    pause
    exit /b 1
)

:: --- Section 3: Build the React GUI frontend ---
echo [2/5] Building React GUI frontend (npm run build)...
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo WARNING: Node.js not found in PATH. Skipping GUI frontend build.
    goto :skip_npm
)

cd "%PROJECT_DIR%\gui"
if not exist "node_modules" (
    echo Installing frontend dependencies...
    call npm install
)
call npm run build
if %ERRORLEVEL% neq 0 (
    echo Error building the GUI frontend.
    pause
    exit /b %ERRORLEVEL%
)
cd "%PROJECT_DIR%"
:skip_npm

:: --- Section 4 & 5: Configure and Compile CoolSolve ---
if not exist "%PROJECT_DIR%\build\Release" mkdir "%PROJECT_DIR%\build\Release"

if not defined CMAKE_EXE goto :no_cmake

echo [3/5] Configuring CMake...
cd "%PROJECT_DIR%\build"
set "PreferredToolArchitecture=x64"
"%CMAKE_EXE%" "%PROJECT_DIR%" -G "Visual Studio 17 2022" -A x64 -DCOOLSOLVE_BUILD_GUI=ON -DCOOLSOLVE_BUILD_TESTS=OFF -DCOOLSOLVE_LIBRARY_TAG="%LIBRARY_TAG%" -DPython_EXECUTABLE="%PYTHON_EXE%"
if errorlevel 1 goto :cmake_failed

echo [4/5] Compiling CoolSolve with GUI (Release)...
taskkill /F /IM coolsolve.exe >nul 2>&1
"%CMAKE_EXE%" --build . --config Release --target coolsolve
if errorlevel 1 (
    echo Error during compilation.
    pause
    exit /b 1
)
goto :after_compile

:cmake_failed
echo CMake configuration with Visual Studio 17 2022 did not complete.
cd "%PROJECT_DIR%"

:no_cmake

:: Fallback if CMake or VS C++ is absent: use installed or existing binary
if exist "%PROJECT_DIR%\build\Release\coolsolve.exe" (
    echo [3/5] Using existing binary at build\Release\coolsolve.exe
    goto :after_compile
)

if exist "C:\Program Files\CoolSolve\coolsolve.exe" (
    echo [3/5] Copying binary from C:\Program Files\CoolSolve\coolsolve.exe
    copy /y "C:\Program Files\CoolSolve\coolsolve.exe" "%PROJECT_DIR%\build\Release\coolsolve.exe" >nul
    goto :after_compile
)

echo.
echo ERROR: coolsolve.exe could not be compiled and was not found in:
echo   - %PROJECT_DIR%\build\Release\coolsolve.exe
echo   - C:\Program Files\CoolSolve\coolsolve.exe
echo.
echo To compile from source, install Visual Studio 2022 C++ Build Tools and CMake:
echo   winget install Microsoft.VisualStudio.2022.BuildTools
echo   winget install Kitware.CMake
pause
exit /b 1

:after_compile

:: --- Section 6: Generate installer with NSIS ---
echo [5/5] Generating Windows Installer...
cd "%PROJECT_DIR%"
if not defined MAKENSIS_EXE goto :no_nsis
if not exist "%MAKENSIS_EXE%" goto :no_nsis

"%MAKENSIS_EXE%" "%PROJECT_DIR%\coolsolve.nsi"
if errorlevel 1 (
    echo Error during installer generation.
    pause
    exit /b 1
)

set "INSTALLER_NAME="
for /f "delims=" %%F in ('dir /b /o-d "%PROJECT_DIR%\CoolSolve*_v*_Installer.exe" 2^>nul') do if not defined INSTALLER_NAME set "INSTALLER_NAME=%%F"
echo.
echo ============================================================
echo SUCCESS! %INSTALLER_NAME% has been created in:
echo   %PROJECT_DIR%
echo ============================================================
goto :done

:no_nsis
echo.
echo NOTE: makensis.exe not found. To build the installer exe, install NSIS:
echo   winget install NSIS.NSIS
echo Then re-run build_installer.bat.

:done
pause
endlocal
exit /b 0


:: ============================================================
:: Subroutine: locate Python 3
:: ============================================================
:find_python
if defined PYTHON_EXE if exist "%PYTHON_EXE%" exit /b 0

:: 1. WinPython user installations
for %%P in (
    "%USERPROFILE%\Python\WinPython\python\python.exe"
    "C:\Users\dacts\Python\WinPython\python\python.exe"
    "%LOCALAPPDATA%\Programs\Python\Python313\python.exe"
    "%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
    "%LOCALAPPDATA%\Programs\Python\Python311\python.exe"
    "%LOCALAPPDATA%\Programs\Python\Python310\python.exe"
    "C:\Python312\python.exe"
    "C:\Python311\python.exe"
    "C:\Anaconda3\python.exe"
    "C:\ProgramData\Anaconda3\python.exe"
) do (
    if exist %%~P (
        set "PYTHON_EXE=%%~P"
        exit /b 0
    )
)

:: 2. python on PATH
for /f "delims=" %%i in ('where python 2^>nul') do (
    %%i --version >nul 2>&1
    if not errorlevel 1 (
        set "PYTHON_EXE=%%i"
        exit /b 0
    )
)
exit /b 1


:: ============================================================
:: Subroutine: locate CMake
:: ============================================================
:find_cmake
if defined CMAKE_EXE if exist "%CMAKE_EXE%" exit /b 0

for /f "delims=" %%i in ('where cmake 2^>nul') do (
    set "CMAKE_EXE=%%i"
    exit /b 0
)

for %%C in (
    "C:\Program Files\CMake\bin\cmake.exe"
    "C:\Program Files (x86)\CMake\bin\cmake.exe"
    "%LOCALAPPDATA%\Programs\CMake\bin\cmake.exe"
    "C:\Program Files\Microsoft Visual Studio\2022\Community\Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin\cmake.exe"
    "C:\Program Files\Microsoft Visual Studio\2022\BuildTools\Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin\cmake.exe"
    "C:\Program Files\Microsoft Visual Studio\2022\Enterprise\Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin\cmake.exe"
    "C:\Program Files\Microsoft Visual Studio\2022\Professional\Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin\cmake.exe"
    "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin\cmake.exe"
) do (
    if exist %%~C (
        set "CMAKE_EXE=%%~C"
        exit /b 0
    )
)
set "CMAKE_EXE="
exit /b 0


:: ============================================================
:: Subroutine: locate NSIS (makensis.exe)
:: ============================================================
:find_nsis
if defined MAKENSIS_EXE if exist "%MAKENSIS_EXE%" exit /b 0

for /f "delims=" %%i in ('where makensis 2^>nul') do (
    set "MAKENSIS_EXE=%%i"
    exit /b 0
)

for %%M in (
    "C:\Program Files\NSIS\makensis.exe"
    "C:\Program Files (x86)\NSIS\makensis.exe"
    "%LOCALAPPDATA%\Programs\NSIS\makensis.exe"
    "%PROGRAMFILES%\NSIS\Bin\makensis.exe"
    "%PROGRAMFILES(X86)%\NSIS\Bin\makensis.exe"
) do (
    if exist %%~M (
        set "MAKENSIS_EXE=%%~M"
        exit /b 0
    )
)
set "MAKENSIS_EXE="
exit /b 0
