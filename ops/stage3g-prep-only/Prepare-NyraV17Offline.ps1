#requires -Version 5.1
[CmdletBinding()]
param(
    [ValidateSet('Prepare','Verify')][string]$Mode='Verify',
    [string]$ArchivePath=(Join-Path $PSScriptRoot 'NYRA-PR36-ALIGNMENT-SUCCESSOR-v17-REVIEW.zip'),
    [string]$WorkDirectory=(Join-Path (Split-Path $PSScriptRoot -Parent) 'nyra-v17-work-prepared')
)
Set-StrictMode -Version 2
$ErrorActionPreference='Stop'
Import-Module (Join-Path $PSScriptRoot 'NyraPreparationOnly.psm1') -Force -DisableNameChecking
$ArchiveHash='f1e5eaa8e129b87fffb8cff66fcb246b132d9d303f8e293a8197f88a38d7fa97'
Assert-NyraPreparation (Test-Path -LiteralPath $ArchivePath -PathType Leaf) 'ORIGINAL_ARCHIVE_NOT_FOUND'
Assert-NyraPreparation ((Get-NyraPreparationHash $ArchivePath) -ceq $ArchiveHash) 'ORIGINAL_ARCHIVE_HASH_MISMATCH'
$Work=[IO.Path]::GetFullPath($WorkDirectory)
$StatePath=Join-Path $Work 'PREPARATION-STATE.json'
Assert-NyraNoReparseAncestors $Work
if($Mode -ceq 'Prepare'){
    Assert-NyraPreparation (!(Test-Path -LiteralPath $Work)) 'WORK_DIRECTORY_EXISTS_USE_VERIFY_NO_REPLAY'
    $Extracted=Join-Path $Work 'original-v17'
    $Extraction=Expand-NyraPreparationArchive $ArchivePath $Extracted $ArchiveHash
    $Inputs=Test-NyraPreparationInputs $Extracted
    $Planned=Join-Path $Work ('successor-after-explicit-resume-'+[guid]::NewGuid().ToString('N'))
    Assert-NyraPreparation (!(Test-Path -LiteralPath $Planned)) 'PLANNED_OUTPUT_EXISTS'
    $State=[ordered]@{schema='nyra.v17.preparation-only.v1';archivePath=[IO.Path]::GetFullPath($ArchivePath);archiveSHA256=$ArchiveHash;extractedDirectory=$Extracted;plannedOutputDirectory=$Planned;inputPins=$Inputs.pins;sourceSHA=$Inputs.sourceSHA;treeSHA=$Inputs.treeSHA;parents=$Inputs.parents;serializerReproducesOriginalTLS=$Inputs.serializerReproducesOriginalTLS;serializerProbeSHA256=$Inputs.serializerProbeSHA256;checkedAtUTC=[DateTime]::UtcNow.ToString('o');generatorInvoked=$false;fourHourWindowGenerated=$false;protectedSessionStarted=$false;ownerResumeRequired=$true}
    [IO.File]::WriteAllText($StatePath,($State|ConvertTo-Json -Depth 30)+[Environment]::NewLine,(New-Object Text.UTF8Encoding($false)))
}else{
    Assert-NyraPreparation (Test-Path -LiteralPath $StatePath -PathType Leaf) 'PREPARATION_STATE_MISSING_RUN_PREPARE'
    $State=Get-Content -LiteralPath $StatePath -Raw|ConvertFrom-Json
    Assert-NyraPreparation ($State.schema -ceq 'nyra.v17.preparation-only.v1' -and $State.archiveSHA256 -ceq $ArchiveHash -and $State.generatorInvoked -eq $false -and $State.fourHourWindowGenerated -eq $false -and $State.protectedSessionStarted -eq $false) 'PREPARATION_STATE_BINDING'
    Assert-NyraPreparation ([IO.Path]::GetFullPath($State.archivePath) -ceq [IO.Path]::GetFullPath($ArchivePath)) 'ARCHIVE_PATH_CHANGED'
    Assert-NyraPreparation ([IO.Path]::GetFullPath($State.extractedDirectory) -ceq (Join-Path $Work 'original-v17')) 'EXTRACTED_PATH_CHANGED'
    $Inputs=Test-NyraPreparationInputs $State.extractedDirectory
    Assert-NyraPreparation ($State.sourceSHA -ceq $Inputs.sourceSHA -and $State.treeSHA -ceq $Inputs.treeSHA -and ($State.parents -join ' ') -ceq ($Inputs.parents -join ' ') -and $State.ownerResumeRequired -eq $true) 'STATE_SOURCE_BINDING'
    $PlannedFull=[IO.Path]::GetFullPath($State.plannedOutputDirectory)
    Assert-NyraPreparation ((Split-Path $PlannedFull -Parent) -ceq $Work -and (Split-Path $PlannedFull -Leaf) -cmatch '^successor-after-explicit-resume-[a-f0-9]{32}$') 'PLANNED_OUTPUT_PATH_BINDING'
    Assert-NyraPreparation (!(Test-Path -LiteralPath $State.plannedOutputDirectory)) 'PLANNED_OUTPUT_ALREADY_EXISTS_RECONCILE'
}
Write-Host ('NYRA_PREPARATION_ONLY_VERIFIED; STATE='+$StatePath)
Write-Host ('GENERATOR_INVOKED=False; FOUR_HOUR_WINDOW=False; PROTECTED_SESSION=False; SERIALIZER_MATCH='+$Inputs.serializerReproducesOriginalTLS)
Write-Host ('PLANNED_OUTPUT_NOT_CREATED='+$State.plannedOutputDirectory)
if(!$Inputs.serializerReproducesOriginalTLS){Write-Warning 'SERIALIZER_COMPATIBILITY_STOP: this runtime does not reproduce the accepted TLS bytes. Do not run the generator or rewrite pins. Resolve the runtime compatibility after explicit Owner resume.'}
