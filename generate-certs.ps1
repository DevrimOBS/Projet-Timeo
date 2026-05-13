# Generate self-signed certificates for TLS/HTTPS (Windows PowerShell)

$CertDir = ".\certs"
$Days = 365

# Create certs directory if it doesn't exist
if (-not (Test-Path $CertDir)) {
    New-Item -ItemType Directory -Path $CertDir | Out-Null
}

Write-Host "Generating self-signed TLS certificates..." -ForegroundColor Green

# Generate self-signed certificate using Windows built-in PowerShell
$cert = New-SelfSignedCertificate `
    -DnsName "localhost", "*.novisec.local" `
    -FriendlyName "NoviSec API Server" `
    -KeyLength 2048 `
    -KeyAlgorithm RSA `
    -CertStoreLocation "Cert:\LocalMachine\My" `
    -NotAfter (Get-Date).AddDays($Days) `
    -TextExtension "2.5.29.17={text}DNS=localhost&DNS=*.novisec.local&IPAddress=127.0.0.1"

Write-Host "Certificate thumbprint: $($cert.Thumbprint)" -ForegroundColor Yellow

# Export to PFX format (for Node.js / NestJS)
$PfxPath = "$CertDir\server.pfx"
$CrtPath = "$CertDir\server.crt"
$KeyPath = "$CertDir\server.key"

$securePassword = ConvertTo-SecureString -String "novisec-secure-pass" -AsPlainText -Force
Export-PfxCertificate -Cert $cert -FilePath $PfxPath -Password $securePassword | Out-Null

Write-Host ""
Write-Host "✅ Certificates generated in $CertDir" -ForegroundColor Green
Write-Host "  - server.pfx   (PFX format for Node.js)"
Write-Host "  - Thumbprint: $($cert.Thumbprint)"
Write-Host ""
Write-Host "Valid for $Days days"
Write-Host ""
Write-Host "To use in production, purchase real certificates from a CA (Let's Encrypt, etc.)" -ForegroundColor Yellow
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Copy server.pfx to api/certs/"
Write-Host "2. Set HTTPS_KEY_FILE and HTTPS_CERT_FILE env vars"
Write-Host "3. Restart API service"
