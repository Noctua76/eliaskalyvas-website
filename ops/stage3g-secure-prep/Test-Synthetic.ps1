#requires -Version 5.1
[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$OutputDirectory)
Set-StrictMode -Version 2
$ErrorActionPreference='Stop'
if ($PSVersionTable.PSEdition -cne 'Desktop' -or $PSVersionTable.PSVersion.Major -ne 5 -or $PSVersionTable.PSVersion.Minor -ne 1) { throw 'NATIVE_WINDOWS_POWERSHELL51_REQUIRED' }
$ParseTokens=$null;$ParseErrors=$null
$null=[Management.Automation.Language.Parser]::ParseFile($PSCommandPath,[ref]$ParseTokens,[ref]$ParseErrors)
if ($ParseErrors.Count -ne 0) {throw 'POWERSHELL_PARSE_FAILED'}
$PythonVersion=(& python --version 2>&1 | Out-String).Trim()
if ($LASTEXITCODE -ne 0 -or $PythonVersion -notmatch '^Python 3\.') {throw 'PYTHON3_REQUIRED'}
$NodeVersion=(& node --version | Out-String).Trim()
if ($LASTEXITCODE -ne 0 -or $NodeVersion -notmatch '^v22\.') {throw 'NODE22_REQUIRED'}
foreach($Name in @('envelope.mjs','test-transfer.mjs')) {
    & node --check (Join-Path $PSScriptRoot $Name)
    if($LASTEXITCODE -ne 0){throw 'NODE_SYNTAX_FAILED'}
}
if(Test-Path -LiteralPath $OutputDirectory){throw 'OUTPUT_DIRECTORY_EXISTS_NO_OVERWRITE'}
$PrivateDirectory=Join-Path $env:RUNNER_TEMP ('nyra-synthetic-private-'+[guid]::NewGuid().ToString('N'))
$null=New-Item -ItemType Directory -Path $PrivateDirectory
try {
    $TextPath=Join-Path $PrivateDirectory 'fixture.txt'
    [IO.File]::WriteAllText($TextPath,'PUBLIC_SYNTHETIC_NYRA_TRANSFER_FIXTURE',(New-Object Text.UTF8Encoding($false)))
    $ZipPath=Join-Path $PrivateDirectory 'fixture.zip'
    Compress-Archive -LiteralPath $TextPath -DestinationPath $ZipPath -CompressionLevel Optimal
    & node (Join-Path $PSScriptRoot 'test-transfer.mjs') $ZipPath $OutputDirectory
    if($LASTEXITCODE -ne 0){throw 'SYNTHETIC_TRANSFER_TEST_FAILED'}
} finally {
    if(Test-Path -LiteralPath $PrivateDirectory){Remove-Item -LiteralPath $PrivateDirectory -Recurse -Force}
}
if(Test-Path -LiteralPath $PrivateDirectory){throw 'PLAINTEXT_CLEANUP_FAILED'}
$ProofPath=Join-Path $OutputDirectory 'proof.json'
$Proof=Get-Content -LiteralPath $ProofPath -Raw|ConvertFrom-Json
$Proof.plaintextFilesRemoved=$true
$Proof|Add-Member -NotePropertyName powershell -NotePropertyValue $PSVersionTable.PSVersion.ToString()
$Proof|Add-Member -NotePropertyName powershellEdition -NotePropertyValue $PSVersionTable.PSEdition
$Proof|Add-Member -NotePropertyName python -NotePropertyValue $PythonVersion
$Proof|Add-Member -NotePropertyName verifiedAtUTC -NotePropertyValue ([DateTime]::UtcNow.ToString('o'))
[IO.File]::WriteAllText($ProofPath,($Proof|ConvertTo-Json -Depth 20)+[Environment]::NewLine,(New-Object Text.UTF8Encoding($false)))
Write-Host ('NYRA_WINDOWS_TRANSFER_READINESS_PASS; CASES='+$Proof.checks.Count+'; PRIVATE_INPUT_TRANSFERRED=False')
