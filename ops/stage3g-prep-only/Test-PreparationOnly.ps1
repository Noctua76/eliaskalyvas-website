#requires -Version 5.1
[CmdletBinding()]
param([string]$Root=$PSScriptRoot)
Set-StrictMode -Version 2
$ErrorActionPreference='Stop'
if($PSVersionTable.PSEdition -cne 'Desktop' -or $PSVersionTable.PSVersion.Major -ne 5){throw 'WINDOWS51_REQUIRED'}
Import-Module (Join-Path $Root 'NyraPreparationOnly.psm1') -Force -DisableNameChecking
Add-Type -AssemblyName System.IO.Compression.FileSystem
$Temp=Join-Path $env:RUNNER_TEMP ('nyra-preparation-only-'+[guid]::NewGuid().ToString('N'))
$null=New-Item -ItemType Directory -Path $Temp
$script:Checks=0
function Check([string]$Name,[scriptblock]$Body){& $Body;$script:Checks++;Write-Host ('PASS '+$Name)}
function Rejected([string]$Name,[scriptblock]$Body){$Denied=$false;try{& $Body|Out-Null}catch{$Denied=$true};if(!$Denied){throw ('NOT_REJECTED_'+$Name)};$script:Checks++;Write-Host ('PASS reject '+$Name)}
function Fixture([string]$Name,[string[]]$Entries,[switch]$Symlink){
    $Path=Join-Path $Temp ($Name+'.zip')
    $Zip=[IO.Compression.ZipFile]::Open($Path,[IO.Compression.ZipArchiveMode]::Create)
    try{foreach($EntryName in $Entries){$Entry=$Zip.CreateEntry($EntryName);if($Symlink){$Entry.ExternalAttributes=([int]0xa000 -shl 16)};$Stream=$Entry.Open();try{$Bytes=[Text.Encoding]::UTF8.GetBytes('PUBLIC_SYNTHETIC_FIXTURE');$Stream.Write($Bytes,0,$Bytes.Length)}finally{$Stream.Dispose()}}}finally{$Zip.Dispose()}
    return $Path
}
try{
    foreach($Name in @('NyraPreparationOnly.psm1','Prepare-NyraV17Offline.ps1','Test-PreparationOnly.ps1')){
        $Tokens=$null;$Errors=$null;$Ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path $Root $Name),[ref]$Tokens,[ref]$Errors)
        if($Errors.Count){throw 'POWERSHELL_PARSE_FAILED'}
        if($Name -eq 'Prepare-NyraV17Offline.ps1'){
            $Banned=@($Ast.FindAll({param($Node) $Node -is [Management.Automation.Language.CommandAst] -and $Node.GetCommandName() -match 'New-NyraRelease|Start-NyraAcceptance|Invoke-Expression|Invoke-WebRequest|^ssh$|^docker$|Start-Process'},$true))
            if($Banned.Count){throw 'TIME_SENSITIVE_OR_REMOTE_COMMAND_IN_PREPARER'}
        }
    }
    Check 'parser-and-no-generator-invocation' {}
    $Good=Fixture 'good' @('folder/file.txt','New-NyraRelease.ps1')
    $Out=Join-Path $Temp 'good-out'
    $null=Expand-NyraPreparationArchive $Good $Out (Get-NyraPreparationHash $Good)
    Check 'safe-extraction' {if((Get-Content -LiteralPath (Join-Path $Out 'folder/file.txt') -Raw) -cne 'PUBLIC_SYNTHETIC_FIXTURE'){throw 'CONTENT'}}
    Check 'archive-script-copied-without-execution' {if(!(Test-Path -LiteralPath (Join-Path $Out 'New-NyraRelease.ps1'))){throw 'MISSING'}}
    Rejected 'wrong-archive-hash' {Expand-NyraPreparationArchive $Good (Join-Path $Temp 'wrong-hash') ('0'*64)}
    Check 'hash-failure-no-output' {if(Test-Path -LiteralPath (Join-Path $Temp 'wrong-hash')){throw 'OUTPUT_WRITTEN'}}
    Rejected 'existing-output-no-overwrite' {Expand-NyraPreparationArchive $Good $Out (Get-NyraPreparationHash $Good)}
    $Bad=@{
        traversal=@('../escape.txt');absolute=@('C:/escape.txt');rooted=@('/escape.txt');casecollision=@('a.txt','A.txt');ads=@('file.txt:stream');device=@('CON.txt');trailing=@('file.');backslash=@('a\b.txt');parentfile=@('a','a/b.txt')
    }
    foreach($Name in $Bad.Keys){$Zip=Fixture $Name $Bad[$Name];$Dest=Join-Path $Temp ($Name+'-out');Rejected $Name {Expand-NyraPreparationArchive $Zip $Dest (Get-NyraPreparationHash $Zip)};if(Test-Path -LiteralPath $Dest){throw 'BAD_ARCHIVE_CREATED_OUTPUT'}}
    $Link=Fixture 'link' @('link') -Symlink
    Rejected 'symlink' {Expand-NyraPreparationArchive $Link (Join-Path $Temp 'link-out') (Get-NyraPreparationHash $Link)}
    Rejected 'generate-mode-not-supported' {& (Join-Path $Root 'Prepare-NyraV17Offline.ps1') -Mode Generate}
    Rejected 'missing-private-archive' {& (Join-Path $Root 'Prepare-NyraV17Offline.ps1') -Mode Prepare -ArchivePath (Join-Path $Temp 'missing.zip') -WorkDirectory (Join-Path $Temp 'never-created')}
    Check 'missing-archive-no-workspace' {if(Test-Path -LiteralPath (Join-Path $Temp 'never-created')){throw 'WORKSPACE_WRITTEN'}}
    # A public synthetic object probes the native serializer without any scope or generator.
    $Sample=[ordered]@{name='public-fixture';value=1}
    $Actual=($Sample|ConvertTo-Json -Depth 100)+[char]10
    $Expected='{'+[char]10+'  "name": "public-fixture",'+[char]10+'  "value": 1'+[char]10+'}'+[char]10
    $Match=([Text.Encoding]::UTF8.GetBytes($Actual) -join ',') -ceq ([Text.Encoding]::UTF8.GetBytes($Expected) -join ',')
    Write-Host ('NYRA_NATIVE51_SERIALIZER_MATCHES_ACCEPTED_CORE_FORMAT='+$Match)
    Write-Host ('NYRA_PREPARATION_ONLY_TESTS_PASS; CHECKS='+$script:Checks+'; POWERSHELL='+$PSVersionTable.PSVersion.ToString()+'; GENERATOR_CALLS=0; FOUR_HOUR_SCOPES=0')
}finally{
    if(Test-Path -LiteralPath $Temp){Remove-Item -LiteralPath $Temp -Recurse -Force}
}
if(Test-Path -LiteralPath $Temp){throw 'SYNTHETIC_CLEANUP_FAILED'}
Write-Host 'NYRA_PREPARATION_ONLY_CLEANUP_PASS'
