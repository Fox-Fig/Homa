@echo off
setlocal
echo Building Homa Single-Binary Installers (Cross-Platform)...

if not exist release mkdir release
if not exist "cmd\homa-installer\embedded" mkdir "cmd\homa-installer\embedded"

REM Define mapping for builds
REM Format: OS|ARCH|SUFFIX

echo.
echo [ICONS] Generating Icons...
go run icon_gen.go
if %ERRORLEVEL% NEQ 0 goto error

echo.
echo [EXT] Building Extensions...
go run builder.go
if %ERRORLEVEL% NEQ 0 goto error

call :BuildTarget windows amd64 .exe
if %ERRORLEVEL% NEQ 0 goto error

call :BuildTarget linux amd64 ""
if %ERRORLEVEL% NEQ 0 goto error

call :BuildTarget darwin amd64 ""
if %ERRORLEVEL% NEQ 0 goto error

call :BuildTarget darwin arm64 ""
if %ERRORLEVEL% NEQ 0 goto error

echo ----------------------
echo Build Success! Check 'release' folder.
echo ----------------------
pause
exit /b 0

:BuildTarget
set T_OS=%1
set T_ARCH=%2
set T_EXT=%3
set OUT_NAME=homa-installer-%T_OS%-%T_ARCH%
if "%T_OS%"=="windows" set OUT_NAME=homa-installer-windows.exe

echo.
echo [%T_OS%/%T_ARCH%] 1. Building Host...
set GOOS=%T_OS%
set GOARCH=%T_ARCH%
go build -o cmd/homa-installer/embedded/homa-host.exe ./cmd/homa-host
if %ERRORLEVEL% NEQ 0 exit /b 1

echo [%T_OS%/%T_ARCH%] 2. Building Installer (Embedding Host)...
go build -o release/%OUT_NAME% ./cmd/homa-installer
if %ERRORLEVEL% NEQ 0 exit /b 1

echo [%T_OS%/%T_ARCH%] Done.
exit /b 0

:error
echo Build Failed!
pause
exit /b 1
