$ErrorActionPreference = "Stop"

$repo = "Fox-Fig/Homa"
$assetName = "homa-installer-windows.exe"

Write-Host "======================================"
Write-Host "       Homa Installer (Windows)       "
Write-Host "======================================"

Write-Host "Fetching latest release information..."
$releaseUrl = "https://api.github.com/repos/$repo/releases/latest"

try {
    $releaseInfo = Invoke-RestMethod -Uri $releaseUrl -UseBasicParsing
    $assetUrl = $releaseInfo.assets | Where-Object { $_.name -eq $assetName } | Select-Object -ExpandProperty browser_download_url

    if (-not $assetUrl) {
        Write-Host "Error: Could not find asset $assetName for the latest release." -ForegroundColor Red
        Write-Host "Please check https://github.com/$repo/releases manually."
        exit 1
    }

    $tempDir = Join-Path $env:TEMP "homa-install"
    if (-not (Test-Path $tempDir)) {
        New-Item -ItemType Directory -Path $tempDir | Out-Null
    }

    $downloadPath = Join-Path $tempDir $assetName

    Write-Host "Downloading $assetName..."
    Invoke-WebRequest -Uri $assetUrl -OutFile $downloadPath -UseBasicParsing

    Write-Host "Running Homa Installer..."
    Start-Process -FilePath $downloadPath -Wait

    Write-Host "======================================"
    Write-Host "Installation complete!" -ForegroundColor Green

} catch {
    Write-Host "An error occurred during installation: $_" -ForegroundColor Red
    exit 1
}
