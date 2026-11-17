#requires -Version 5.1
Set-StrictMode -Version 2
$ErrorActionPreference='Stop'
function Assert-NyraPreparation($Condition,[string]$Code) { if(!$Condition){throw $Code} }
function Get-NyraPreparationHash([string]$Path) {
    $Item=Get-Item -LiteralPath $Path
    Assert-NyraPreparation (!$Item.PSIsContainer -and (($Item.Attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0)) 'INPUT_FILE_TYPE'
    (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}
function Assert-NyraNoReparseAncestors([string]$Path) {
    $Current=[IO.Path]::GetFullPath($Path)
    while($Current){
        if(Test-Path -LiteralPath $Current){
            $Item=Get-Item -LiteralPath $Current
            Assert-NyraPreparation (($Item.Attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0) 'REPARSE_PATH'
        }
        $Parent=Split-Path -Path $Current -Parent
        if($Parent -ceq $Current){break};$Current=$Parent
    }
}
function Expand-NyraPreparationArchive([string]$ArchivePath,[string]$Destination,[string]$ExpectedSHA256) {
    Assert-NyraPreparation ($ExpectedSHA256 -cmatch '^[a-f0-9]{64}$') 'ARCHIVE_HASH_FORMAT'
    Assert-NyraPreparation ((Get-NyraPreparationHash $ArchivePath) -ceq $ExpectedSHA256) 'ARCHIVE_HASH_MISMATCH'
    $Root=[IO.Path]::GetFullPath($Destination)
    Assert-NyraPreparation (!(Test-Path -LiteralPath $Root)) 'EXTRACTION_DIRECTORY_EXISTS_NO_OVERWRITE'
    Assert-NyraNoReparseAncestors $Root
    Add-Type -AssemblyName System.IO.Compression
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $Zip=[IO.Compression.ZipFile]::OpenRead([IO.Path]::GetFullPath($ArchivePath))
    try {
        $Types=[Collections.Generic.Dictionary[string,bool]]::new([StringComparer]::OrdinalIgnoreCase)
        $Total=[long]0
        Assert-NyraPreparation ($Zip.Entries.Count -gt 0 -and $Zip.Entries.Count -le 2000) 'ZIP_ENTRY_BOUND'
        foreach($Entry in $Zip.Entries){
            $Name=$Entry.FullName;$Relative=$Name.TrimEnd([char[]]'/')
            Assert-NyraPreparation ($Relative -and !$Name.Contains('\') -and !$Name.StartsWith('/')) 'ZIP_PATH'
            foreach($Part in ($Relative -split '/')){
                Assert-NyraPreparation ($Part -and $Part -notin @('.','..') -and $Part -notmatch '[<>:"|?*\x00-\x1f]' -and $Part -notmatch '[ .]$' -and $Part -notmatch '^(?i:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)') 'ZIP_WINDOWS_PATH'
            }
            Assert-NyraPreparation (!$Types.ContainsKey($Relative)) 'ZIP_DUPLICATE_CASE_PATH'
            Assert-NyraPreparation ((([long]$Entry.ExternalAttributes -shr 16) -band 0xf000) -ne 0xa000) 'ZIP_SYMLINK'
            Assert-NyraPreparation (([long]$Entry.ExternalAttributes -band 1024) -eq 0) 'ZIP_REPARSE'
            $Types.Add($Relative,$Name.EndsWith('/'))
            $Total+=$Entry.Length
            Assert-NyraPreparation ($Entry.Length -le 33554432 -and $Total -le 104857600) 'ZIP_SIZE_BOUND'
        }
        foreach($Relative in $Types.Keys){
            $Parts=$Relative -split '/'
            for($I=1;$I -lt $Parts.Count;$I++){
                $Parent=($Parts[0..($I-1)] -join '/')
                Assert-NyraPreparation (!$Types.ContainsKey($Parent) -or $Types[$Parent]) 'ZIP_FILE_PARENT_CONFLICT'
            }
        }
        $null=New-Item -ItemType Directory -Path $Root -Force
        $Prefix=$Root.TrimEnd([char[]]'\/')+[IO.Path]::DirectorySeparatorChar
        foreach($Entry in $Zip.Entries){
            $Relative=$Entry.FullName.TrimEnd([char[]]'/')
            $Target=[IO.Path]::GetFullPath((Join-Path $Root $Relative.Replace('/',[IO.Path]::DirectorySeparatorChar)))
            Assert-NyraPreparation ($Target.StartsWith($Prefix,[StringComparison]::OrdinalIgnoreCase)) 'ZIP_ESCAPE'
            if($Entry.FullName.EndsWith('/')){$null=[IO.Directory]::CreateDirectory($Target);continue}
            $null=[IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($Target))
            $ZipInputStream=$Entry.Open();$ZipOutputStream=$null
            try{$ZipOutputStream=[IO.File]::Open($Target,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None);$ZipInputStream.CopyTo($ZipOutputStream)}
            finally{if($ZipOutputStream){$ZipOutputStream.Dispose()};$ZipInputStream.Dispose()}
        }
        [pscustomobject]@{entries=$Zip.Entries.Count;expandedBytes=$Total;directory=$Root;archiveSHA256=$ExpectedSHA256}
    } finally {$Zip.Dispose()}
}
function Test-NyraPreparationInputs([string]$Root) {
    $Pins=[ordered]@{
        'New-NyraRelease.ps1'='9390b98db93e66afc7e53e5dc3cfc182a65c7bec0c62d8f9e1193d86194ea82e'
        'NyraOperator.psm1'='e81e526b146d3d63e11ee15ba36433bb013c9dcd9b7223edc8166970fc2309df'
        'actual-release.json'='19436eedb7a47da564d85dd4f13e53761c8c03d4f4717b9e0142cbd1c920b275'
        'baseline-operator/SHA256SUMS'='c84bb361e257be6a223ef16084fe372d4f79d1e31ba14c4e51d7aa2484d43e93'
        'baseline-operator/run-stage3g.ps1'='c49fdb3e576d68810303e4662c4f261c7f260052d55d486f284813288a9af25f'
        'actual-bound-release/operator-package/PR36-TLS-CARRY.json'='12d82a85c36e0c8216b9f6cdca26d9cd730f14954b952a2ecdc2218b337bb8ca'
    }
    foreach($Name in $Pins.Keys){Assert-NyraPreparation ((Get-NyraPreparationHash (Join-Path $Root $Name)) -ceq $Pins[$Name]) 'CRITICAL_INPUT_PIN_MISMATCH'}
    $Release=Get-Content -LiteralPath (Join-Path $Root 'actual-release.json') -Raw|ConvertFrom-Json
    Assert-NyraPreparation ($Release.merged -eq $true -and $Release.sourceSHA -ceq '4edff2353c55469918f2e3a90190916df9a8924d' -and $Release.treeSHA -ceq '8fdac1689db7d0d2172481c4eb446bb20be18962' -and ($Release.parents -join ' ') -ceq '8b82cc964bdbc1919caf91c2669ca154204c025d 225b1bc946b5626e9105f24afd644467852a91af') 'RELEASE_RECEIPT_BINDING'
    # Re-serialization probe only: no generator call, new scope or TLS file write.
    $TLS=Get-Content -LiteralPath (Join-Path $Root 'actual-bound-release/operator-package/PR36-TLS-CARRY.json') -Raw|ConvertFrom-Json
    $Text=($TLS|ConvertTo-Json -Depth 100)+[char]10
    $Hasher=[Security.Cryptography.SHA256]::Create()
    try{$SerializedHash=([BitConverter]::ToString($Hasher.ComputeHash([Text.Encoding]::UTF8.GetBytes($Text)))).Replace('-','').ToLowerInvariant()}finally{$Hasher.Dispose()}
    [pscustomobject]@{pins=$Pins;sourceSHA=$Release.sourceSHA;treeSHA=$Release.treeSHA;parents=$Release.parents;serializerReproducesOriginalTLS=($SerializedHash -ceq $Pins['actual-bound-release/operator-package/PR36-TLS-CARRY.json']);serializerProbeSHA256=$SerializedHash}
}
Export-ModuleMember -Function Assert-NyraPreparation,Get-NyraPreparationHash,Assert-NyraNoReparseAncestors,Expand-NyraPreparationArchive,Test-NyraPreparationInputs
