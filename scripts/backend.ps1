param(
    [ValidateSet('run', 'migrate', 'test', 'check', 'generate')]
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
        if ($line -match '^\s*(DATABASE_URL|TEST_DATABASE_URL|HTTP_ADDR|APP_ORIGIN|COOKIE_SECURE|TRUSTED_PROXIES)=(.*)$') {
            [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2].Trim(), 'Process')
        }
    }
}
$env:GOMODCACHE = Join-Path $projectRoot '.cache/gomod'
$env:GOCACHE = Join-Path $projectRoot '.cache/go-build'
if (-not $env:COOKIE_SECURE -and $EnvFile -eq (Join-Path $projectRoot '.local/dev.env')) { $env:COOKIE_SECURE = 'false' }
if (-not $env:TEST_DATABASE_URL -and $env:DATABASE_URL -and $EnvFile -eq (Join-Path $projectRoot '.local/dev.env')) { $env:TEST_DATABASE_URL = $env:DATABASE_URL }
if ($Task -in @('test', 'check') -and -not $env:TEST_DATABASE_URL) { Write-Warning 'TEST_DATABASE_URL is not set; PostgreSQL integration tests will be skipped.' }
Push-Location (Join-Path $projectRoot 'backend')
try {
    switch ($Task) {
        'run' { go run ./cmd/api }
        'migrate' { go run ./cmd/api -migrate }
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
