#requires -Version 5.1
[CmdletBinding()]
param(
 [string]$WorkDirectory=(Join-Path $env:USERPROFILE 'Downloads\nyra-v17-work-prepared'),
 [string]$StatePath='',
 [ValidateSet('Original','ReviewCandidate')][string]$Writer='Original',
 [string]$ReportDirectory=(Join-Path ([IO.Path]::GetTempPath()) ('nyra-tls-result-'+[guid]::NewGuid().ToString('N')))
)
Set-StrictMode -Version 2
$ErrorActionPreference='Stop'
Import-Module (Join-Path $PSScriptRoot 'NyraTlsCompatibility.psm1') -Force -DisableNameChecking
$OriginalRoot=Join-Path ([IO.Path]::GetFullPath($WorkDirectory)) 'original-v17'
if(!$StatePath){$StatePath=Join-Path $WorkDirectory 'PREPARATION-STATE.json'}
$Before=@{};$Result=$null;$ExitCode=1;$ReportCreated=$false
try{
 Assert-NyraTls (Test-Path -LiteralPath $StatePath -PathType Leaf) 'EXISTING_PREPARATION_STATE_REQUIRED'
 $StateBytes=[IO.File]::ReadAllBytes($StatePath);$StateHash=Get-NyraTlsBytesHash $StateBytes
 $State=[Text.Encoding]::UTF8.GetString($StateBytes)|ConvertFrom-Json
 Assert-NyraTls ($State.schema -ceq 'nyra.v17.preparation-only.v1' -and $State.generatorInvoked -eq $false -and $State.fourHourWindowGenerated -eq $false -and $State.protectedSessionStarted -eq $false -and $State.ownerResumeRequired -eq $true) 'PREPARATION_STATE_BINDING'
 Assert-NyraTls ([IO.Path]::GetFullPath($State.extractedDirectory) -ceq $OriginalRoot) 'PREPARATION_ROOT_BINDING'
 $Planned=[IO.Path]::GetFullPath($State.plannedOutputDirectory)
 Assert-NyraTls ((Split-Path $Planned -Parent) -ceq [IO.Path]::GetFullPath($WorkDirectory) -and (Split-Path $Planned -Leaf) -cmatch '^successor-after-explicit-resume-[a-f0-9]{32}$') 'PREPARATION_OUTPUT_BINDING'
 Assert-NyraTls (!(Test-Path -LiteralPath $Planned)) 'PREDECESSOR_OUTPUT_EXISTS_NO_OVERWRITE'
 Assert-NyraTls (!(Test-Path -LiteralPath $ReportDirectory)) 'EVIDENCE_DIRECTORY_EXISTS_NO_OVERWRITE'
 foreach($N in @('New-NyraRelease.ps1','NyraOperator.psm1','actual-bound-release/operator-package/PR36-TLS-CARRY.json')){$Before[$N]=Get-NyraTlsBytesHash ([IO.File]::ReadAllBytes((Join-Path $OriginalRoot $N)))}
 $Result=Test-NyraTlsWriterReference -OriginalRoot $OriginalRoot -ArchivePath $State.archivePath -Writer $Writer
 Assert-NyraTls ((Get-NyraTlsBytesHash ([IO.File]::ReadAllBytes($StatePath))) -ceq $StateHash) 'EXISTING_STATE_CHANGED'
 foreach($N in $Before.Keys){Assert-NyraTls ((Get-NyraTlsBytesHash ([IO.File]::ReadAllBytes((Join-Path $OriginalRoot $N)))) -ceq $Before[$N]) 'ORIGINAL_INPUT_CHANGED'}
 Assert-NyraTls (!(Test-Path -LiteralPath $Planned)) 'SUCCESSOR_OUTPUT_CREATED'
 $Result.existingPreparationStatePreserved=$true
 $Result.originalInputsPreserved=$true
 $Result.status=if($Result.compatible){'SERIALIZER_COMPATIBILITY_PASS'}else{'SERIALIZER_COMPATIBILITY_STOP'}
 $null=New-Item -ItemType Directory -Path $ReportDirectory;$ReportCreated=$true
 [IO.File]::WriteAllText((Join-Path $ReportDirectory 'serializer-result.json'),($Result|ConvertTo-Json -Depth 30)+[char]10,(New-Object Text.UTF8Encoding($false)))
 $Result|ConvertTo-Json -Depth 30
 Write-Host $Result.status
 Write-Host ('EVIDENCE='+ (Join-Path $ReportDirectory 'serializer-result.json'))
 if($Result.compatible){$ExitCode=0}
}catch{
 Write-Host 'SERIALIZER_COMPATIBILITY_STOP'
 Write-Host ('STOP_CODE='+$_.Exception.Message)
}
exit $ExitCode
