param(
    [ValidateSet('run', 'migrate', 'seed', 'test', 'check', 'generate')]
    [string]$Task = 'run',
    [string]$EnvFile
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not $EnvFile) {
    foreach ($candidate in @((Join-Path $projectRoot '.env'), (Join-Path $projectRoot '.local/dev.env'))) {
        if (Test-Path -LiteralPath $candidate) { $EnvFile = $candidate; break }
    }
}
if ($EnvFile) {
    foreach ($line in Get-Content -LiteralPath $EnvFile) {
        if ($line -match '^\s*(APP_ENV|DEV_SEED_PASSWORD|DATABASE_URL|TEST_DATABASE_URL|HTTP_ADDR|APP_ORIGIN|COOKIE_SECURE|TRUSTED_PROXIES)=(.*)$') {
            [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2].Trim(), 'Process')
        }
    }
}
$env:GOMODCACHE = Join-Path $projectRoot '.cache/gomod'
$env:GOCACHE = Join-Path $projectRoot '.cache/go-build'
if (-not $env:COOKIE_SECURE -and $EnvFile -eq (Join-Path $projectRoot '.local/dev.env')) { $env:COOKIE_SECURE = 'false' }
if (-not $env:TEST_DATABASE_URL -and $env:DATABASE_URL -and $EnvFile -eq (Join-Path $projectRoot '.local/dev.env')) { $env:TEST_DATABASE_URL = $env:DATABASE_URL }
if (-not $env:APP_ENV -and $EnvFile -eq (Join-Path $projectRoot '.local/dev.env')) { $env:APP_ENV = 'development' }
if ($Task -eq 'seed') {
    if ($env:APP_ENV -ne 'development') { throw 'seed requires APP_ENV=development; no database changes made.' }
    $seedPasswordFile = Join-Path $projectRoot '.local/dev-seed-password'
    if (-not $env:DEV_SEED_PASSWORD) {
        if (Test-Path -LiteralPath $seedPasswordFile) {
            $env:DEV_SEED_PASSWORD = (Get-Content -LiteralPath $seedPasswordFile -Raw).Trim()
        } else {
            New-Item -ItemType Directory -Force -Path (Join-Path $projectRoot '.local') | Out-Null
            $seedBytes = New-Object byte[] 24
            $seedRng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
            try { $seedRng.GetBytes($seedBytes) } finally { $seedRng.Dispose() }
            $env:DEV_SEED_PASSWORD = [Convert]::ToBase64String($seedBytes)
            Set-Content -LiteralPath $seedPasswordFile -Value $env:DEV_SEED_PASSWORD -NoNewline
        }
        Write-Host 'Development password: .local/dev-seed-password (Git-ignored; existing passwords are never reset).
Users: owner@numdock.test, admin@numdock.test, member@numdock.test, isolated@numdock.test'
    }
}
if ($Task -in @('test', 'check') -and -not $env:TEST_DATABASE_URL) { Write-Warning 'TEST_DATABASE_URL is not set; PostgreSQL integration tests will be skipped.' }
Push-Location (Join-Path $projectRoot 'backend')
try {
    switch ($Task) {
        'run' { go run ./cmd/api }
        'migrate' { go run ./cmd/api -migrate }
        'seed' { go run ./cmd/api -seed }
        'test' { go test -count=1 ./... }
        'check' {
            $unformatted = gofmt -l cmd internal db
            if ($unformatted) { throw "Unformatted Go files: $unformatted" }
            go vet ./...
            if ($LASTEXITCODE -ne 0) { throw 'go vet failed' }
            go test -count=1 ./...
            if ($LASTEXITCODE -ne 0) { throw 'go test failed' }
            go build ./...
        }
        'generate' { go run github.com/sqlc-dev/sqlc/cmd/sqlc@v1.31.1 generate }
    }
    if ($LASTEXITCODE -ne 0) { throw "Backend task failed: $Task" }
} finally { Pop-Location }
