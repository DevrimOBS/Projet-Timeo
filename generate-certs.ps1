param(
    [string]$CertDir = ".\certs",
    [int]$Days = 365,
    [string]$PfxPassword = "novisec-secure-pass",
    [switch]$UseOpenSsl
)

$ErrorActionPreference = "Stop"

$mkcertPath = Join-Path $env:LOCALAPPDATA "Microsoft\WinGet\Links\mkcert.exe"
$mkcert = $null
if (-not $UseOpenSsl) {
    if (Get-Command mkcert -ErrorAction SilentlyContinue) {
        $mkcert = "mkcert"
    }
    elseif (Test-Path $mkcertPath) {
        $mkcert = $mkcertPath
    }
}

if (-not (Test-Path $CertDir)) {
    New-Item -ItemType Directory -Path $CertDir | Out-Null
}

$caKey = Join-Path $CertDir "ca.key"
$caCrt = Join-Path $CertDir "ca.crt"
$serverKey = Join-Path $CertDir "server.key"
$serverCsr = Join-Path $CertDir "server.csr"
$serverExt = Join-Path $CertDir "server.ext"
$serverCrt = Join-Path $CertDir "server.crt"
$serverPfx = Join-Path $CertDir "server.pfx"
$caSerial = Join-Path $CertDir "ca.srl"

Write-Host "Generating local TLS certificates in $CertDir..." -ForegroundColor Green

if ($mkcert) {
    Write-Host "Using mkcert for trusted local certificates..." -ForegroundColor Cyan

    & $mkcert -install | Out-Null
    $caRoot = & $mkcert -CAROOT
    Copy-Item -Force (Join-Path $caRoot "rootCA.pem") $caCrt

    & $mkcert -cert-file $serverCrt -key-file $serverKey localhost 127.0.0.1 ::1 api vite.novisec.local

    if (Get-Command openssl -ErrorAction SilentlyContinue) {
        openssl pkcs12 -export `
            -in $serverCrt `
            -inkey $serverKey `
            -certfile $caCrt `
            -out $serverPfx `
            -name novisec-server `
            -passout "pass:$PfxPassword"
    }
    else {
        Write-Host "OpenSSL not found: skipping server.pfx generation." -ForegroundColor Yellow
    }

    Write-Host ""
    Write-Host "Certificates generated with mkcert:" -ForegroundColor Green
    Write-Host "  - $caCrt"
    Write-Host "  - $serverCrt"
    Write-Host "  - $serverKey"
    if (Test-Path $serverPfx) {
        Write-Host "  - $serverPfx"
    }
    Write-Host ""
    Write-Host "HTTPS should be trusted by Windows and Chromium-based browsers for localhost." -ForegroundColor Green
    return
}

if (-not (Get-Command openssl -ErrorAction SilentlyContinue)) {
    throw "OpenSSL is required. Install OpenSSL, install mkcert via winget/choco, or run the Bash script in an environment that provides openssl."
}

openssl genrsa -out $caKey 4096
openssl req -x509 -new -nodes `
    -key $caKey `
    -sha256 `
    -days $Days `
    -out $caCrt `
    -subj "/C=FR/ST=IDF/L=Paris/O=NoviSec/CN=NoviSec Local CA"

openssl genrsa -out $serverKey 2048
openssl req -new `
    -key $serverKey `
    -out $serverCsr `
    -subj "/C=FR/ST=IDF/L=Paris/O=NoviSec/CN=api"

@"
authorityKeyIdentifier=keyid,issuer
basicConstraints=CA:FALSE
keyUsage=digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
subjectAltName=DNS:api,DNS:localhost,DNS:*.novisec.local,IP:127.0.0.1
"@ | Set-Content -Encoding ascii $serverExt

openssl x509 -req `
    -in $serverCsr `
    -CA $caCrt `
    -CAkey $caKey `
    -CAcreateserial `
    -days $Days `
    -sha256 `
    -extfile $serverExt `
    -out $serverCrt

openssl pkcs12 -export `
    -in $serverCrt `
    -inkey $serverKey `
    -certfile $caCrt `
    -out $serverPfx `
    -name novisec-server `
    -passout "pass:$PfxPassword"

Remove-Item -Force $serverCsr, $serverExt, $caSerial -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Certificates generated:" -ForegroundColor Green
Write-Host "  - $caCrt"
Write-Host "  - $caKey"
Write-Host "  - $serverCrt"
Write-Host "  - $serverKey"
Write-Host "  - $serverPfx"
Write-Host ""
Write-Host "The server certificate is valid for localhost, 127.0.0.1, api, and *.novisec.local."
