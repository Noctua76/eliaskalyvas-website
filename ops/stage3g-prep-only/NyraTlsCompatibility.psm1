#requires -Version 5.1
Set-StrictMode -Version 2
$ErrorActionPreference='Stop'
function Assert-NyraTls($Value,[string]$Code){if(!$Value){throw $Code}}
function Get-NyraTlsBytesHash([byte[]]$Bytes){
 $H=[Security.Cryptography.SHA256]::Create()
 try{([BitConverter]::ToString($H.ComputeHash($Bytes))).Replace('-','').ToLowerInvariant()}finally{$H.Dispose()}
}
function Assert-NyraTlsFilePin([string]$Path,[string]$Expected){
 Assert-NyraTls ($Expected -cmatch '^[a-f0-9]{64}$') 'PIN_FORMAT'
 $Item=Get-Item -LiteralPath $Path
 Assert-NyraTls (!$Item.PSIsContainer -and ($Item.Attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0) 'PIN_FILE_TYPE'
 Assert-NyraTls ((Get-NyraTlsBytesHash ([IO.File]::ReadAllBytes($Item.FullName))) -ceq $Expected) 'INPUT_HASH_MISMATCH'
}
function Get-NyraTlsByteSummary([byte[]]$Bytes){
 $Text=[Text.Encoding]::UTF8.GetString($Bytes)
 [ordered]@{bytes=$Bytes.Length;sha256=(Get-NyraTlsBytesHash $Bytes);LF=([regex]::Matches($Text,"`n")).Count;CRLF=([regex]::Matches($Text,"`r`n")).Count;utf8BOM=($Bytes.Length -ge 3 -and $Bytes[0] -eq 239 -and $Bytes[1] -eq 187 -and $Bytes[2] -eq 191)}
}
function Compare-NyraTlsBytes([byte[]]$Reference,[byte[]]$Actual){
 $Same=(Get-NyraTlsBytesHash $Reference) -ceq (Get-NyraTlsBytesHash $Actual)
 if($Same){return [ordered]@{equal=$true;category='IDENTICAL';firstDifference=$null}}
 $A=[Text.Encoding]::UTF8.GetString($Reference);$B=[Text.Encoding]::UTF8.GetString($Actual)
 $Category='OTHER_BYTE_MISMATCH'
 if($B.Replace("`r`n","`n") -ceq $A){$Category='CRLF_VERSUS_LF_ONLY'}
 elseif($Actual.Length -ge 3 -and $Actual[0] -eq 239 -and $Actual[1] -eq 187 -and $Actual[2] -eq 191){$Category='UTF8_BOM'}
 else{
  try{
   $ParsedA=$A|ConvertFrom-Json;$ParsedB=$B|ConvertFrom-Json
   $OrderA=@($ParsedA.PSObject.Properties.Name) -join '|';$OrderB=@($ParsedB.PSObject.Properties.Name) -join '|'
   if($OrderA -cne $OrderB){$Category='FIELD_ORDER'}
   elseif(($ParsedA|ConvertTo-Json -Depth 100 -Compress) -ceq ($ParsedB|ConvertTo-Json -Depth 100 -Compress)){$Category='INDENTATION_OR_JSON_WHITESPACE'}
   else{$Category='VALUE_TYPE_OR_ESCAPING'}
  }catch{$Category='ENCODING_OR_INVALID_JSON'}
 }
 $I=0;while($I -lt [Math]::Min($Reference.Length,$Actual.Length) -and $Reference[$I] -eq $Actual[$I]){$I++}
 $Lo=[Math]::Max(0,$I-3);$RA=@();$RB=@()
 for($J=$Lo;$J -lt [Math]::Min($Reference.Length,$I+5);$J++){$RA+=([int]$Reference[$J])}
 for($J=$Lo;$J -lt [Math]::Min($Actual.Length,$I+5);$J++){$RB+=([int]$Actual[$J])}
 [ordered]@{equal=$false;category=$Category;firstDifference=[ordered]@{offsetZeroBased=$I;contextStartsAt=$Lo;referenceByteValues=$RA;actualByteValues=$RB}}
}
function Get-NyraTlsAst([string]$Path){
 $T=$null;$E=$null;$A=[Management.Automation.Language.Parser]::ParseFile($Path,[ref]$T,[ref]$E)
 Assert-NyraTls ($E.Count -eq 0) 'PINNED_SOURCE_PARSE_FAILED';return $A
}
function Get-NyraTlsWriterText($ModuleAst){
 $Functions=@()
 foreach($Name in @('Assert-Nyra','Write-NyraJson')){
  $Matches=@($ModuleAst.FindAll({param($N) $N -is [Management.Automation.Language.FunctionDefinitionAst] -and $N.Name -ceq $Name},$true))
  Assert-NyraTls ($Matches.Count -eq 1) 'PINNED_WRITER_FUNCTION_COUNT';$Functions+=$Matches[0].Extent.Text
 }
 return ($Functions -join "`n")
}
function New-NyraTlsOrderedObject($GeneratorAst,$Receipt){
 $R=$Receipt
 foreach($Name in @('B','H','T','Natives','C')){
  $Assignments=@($GeneratorAst.FindAll({param($N) $N -is [Management.Automation.Language.AssignmentStatementAst] -and $N.Left -is [Management.Automation.Language.VariableExpressionAst] -and $N.Left.VariablePath.UserPath -ceq $Name},$true))
  Assert-NyraTls ($Assignments.Count -eq 1) 'PINNED_TLS_ASSIGNMENT_COUNT'
  # Only these five assignments from the hash-pinned generator are evaluated.
  # No script entrypoint, time assignment, scope construction or orchestration runs.
  . ([scriptblock]::Create($Assignments[0].Extent.Text))
 }
 Assert-NyraTls ($C -is [Collections.Specialized.OrderedDictionary]) 'TLS_ORDERED_OBJECT_REQUIRED'
 return $C
}
function Invoke-NyraTlsWriterProbe {
 param([byte[]]$Reference,$Value,[string]$WriterText,[string]$ScratchDirectory)
 Assert-NyraTls (!(Test-Path -LiteralPath $ScratchDirectory)) 'DIAGNOSTIC_OUTPUT_EXISTS_NO_OVERWRITE'
 $null=New-Item -ItemType Directory -Path $ScratchDirectory
 $Result=$null
 try{
  # A private in-memory module contains only Assert-Nyra + the original writer.
  $WriterModule=New-Module -ScriptBlock ([scriptblock]::Create($WriterText))
  $Hashes=@();$Produced=$null
  foreach($Name in @('first.json','repeat.json')){
   $Path=Join-Path $ScratchDirectory $Name
   Assert-NyraTls (!(Test-Path -LiteralPath $Path)) 'DIAGNOSTIC_FILE_EXISTS'
   & $WriterModule {param($P,$V) Write-NyraJson $P $V} $Path $Value
   $Produced=[IO.File]::ReadAllBytes($Path);$Hashes+=(Get-NyraTlsBytesHash $Produced)
  }
  $Result=[ordered]@{reference=(Get-NyraTlsByteSummary $Reference);writer=(Get-NyraTlsByteSummary $Produced);comparison=(Compare-NyraTlsBytes $Reference $Produced);deterministic=($Hashes[0] -ceq $Hashes[1]);writerFunctionSHA256=(Get-NyraTlsBytesHash ([Text.Encoding]::UTF8.GetBytes($WriterText)));cleanup=$false}
 }finally{if(Test-Path -LiteralPath $ScratchDirectory){Remove-Item -LiteralPath $ScratchDirectory -Recurse -Force}}
 Assert-NyraTls (!(Test-Path -LiteralPath $ScratchDirectory)) 'DIAGNOSTIC_CLEANUP_FAILED'
 $Result.cleanup=$true;return $Result
}
function Get-NyraTlsReviewCandidateText([string]$OriginalWriterText){
 $Old='    $Text=($Value|ConvertTo-Json -Depth 100)+"`n"'
 $New='    Assert-Nyra ($PSVersionTable.PSEdition -ceq ''Core'' -and $PSVersionTable.PSVersion -eq [version]''7.7.0'') ''TLS_SERIALIZER_REQUIRES_CORE_770'''+"`n"+'    $Text=(($Value|ConvertTo-Json -Depth 100).Replace("`r`n","`n"))+"`n"'
 Assert-NyraTls ($OriginalWriterText.Contains($Old)) 'ORIGINAL_WRITER_LINE_NOT_FOUND'
 # Review candidate ONLY. It is never installed over the pinned operator module.
 return $OriginalWriterText.Replace($Old,$New)
}
function Test-NyraTlsWriterReference {
 param([Parameter(Mandatory=$true)][string]$OriginalRoot,[Parameter(Mandatory=$true)][string]$ArchivePath,[ValidateSet('Original','ReviewCandidate')][string]$Writer='Original')
 Assert-NyraTlsFilePin $ArchivePath 'f1e5eaa8e129b87fffb8cff66fcb246b132d9d303f8e293a8197f88a38d7fa97'
 $Pins=[ordered]@{
  'New-NyraRelease.ps1'='9390b98db93e66afc7e53e5dc3cfc182a65c7bec0c62d8f9e1193d86194ea82e'
  'NyraOperator.psm1'='e81e526b146d3d63e11ee15ba36433bb013c9dcd9b7223edc8166970fc2309df'
  'actual-release.json'='19436eedb7a47da564d85dd4f13e53761c8c03d4f4717b9e0142cbd1c920b275'
  'baseline-operator/SHA256SUMS'='c84bb361e257be6a223ef16084fe372d4f79d1e31ba14c4e51d7aa2484d43e93'
  'baseline-operator/run-stage3g.ps1'='c49fdb3e576d68810303e4662c4f261c7f260052d55d486f284813288a9af25f'
  'actual-bound-release/operator-package/PR36-TLS-CARRY.json'='12d82a85c36e0c8216b9f6cdca26d9cd730f14954b952a2ecdc2218b337bb8ca'
 }
 foreach($Name in $Pins.Keys){Assert-NyraTlsFilePin (Join-Path $OriginalRoot $Name) $Pins[$Name]}
 $R=Get-Content -LiteralPath (Join-Path $OriginalRoot 'actual-release.json') -Raw|ConvertFrom-Json
 Assert-NyraTls ($R.merged -eq $true -and $R.sourceSHA -ceq '4edff2353c55469918f2e3a90190916df9a8924d' -and $R.treeSHA -ceq '8fdac1689db7d0d2172481c4eb446bb20be18962' -and ($R.parents -join ' ') -ceq '8b82cc964bdbc1919caf91c2669ca154204c025d 225b1bc946b5626e9105f24afd644467852a91af') 'RELEASE_SOURCE_BINDING'
 $ModuleAst=Get-NyraTlsAst (Join-Path $OriginalRoot 'NyraOperator.psm1')
 $GeneratorAst=Get-NyraTlsAst (Join-Path $OriginalRoot 'New-NyraRelease.ps1')
 $Value=New-NyraTlsOrderedObject $GeneratorAst $R
 $RefPath=Join-Path $OriginalRoot 'actual-bound-release/operator-package/PR36-TLS-CARRY.json'
 $Reference=[IO.File]::ReadAllBytes($RefPath)
 $Parsed=Get-Content -LiteralPath $RefPath -Raw|ConvertFrom-Json
 Assert-NyraTls (($Value.Keys -join '|') -ceq (@($Parsed.PSObject.Properties.Name) -join '|')) 'TLS_FIELD_ORDER_RECONSTRUCTION'
 $RoundTrip=[Text.Encoding]::UTF8.GetBytes(($Parsed|ConvertTo-Json -Depth 100)+[char]10)
 $WriterText=Get-NyraTlsWriterText $ModuleAst
 $TempBase=Join-Path ([IO.Path]::GetTempPath()) ('nyra-tls-diagnostic-'+[guid]::NewGuid().ToString('N'))
 $Original=Invoke-NyraTlsWriterProbe $Reference $Value $WriterText ($TempBase+'-original')
 $Selected=$Original
 if($Writer -ceq 'ReviewCandidate'){$Selected=Invoke-NyraTlsWriterProbe $Reference $Value (Get-NyraTlsReviewCandidateText $WriterText) ($TempBase+'-candidate')}
 [ordered]@{schema='nyra.tls.writer-equivalence.v1';runtime=$PSVersionTable.PSVersion.ToString();edition=$PSVersionTable.PSEdition;operatingSystem=[Environment]::OSVersion.Platform.ToString();writerSelection=$Writer;archivePin='PASS';criticalInputPins=6;sourceTreeParents='PASS';orderedReconstruction='PASS';roundTrip=[ordered]@{bytes=(Get-NyraTlsByteSummary $RoundTrip);comparison=(Compare-NyraTlsBytes $Reference $RoundTrip);expiryType=$Parsed.hostExpiresAt.GetType().FullName};originalWriter=$Original;selectedWriter=$Selected;compatible=($Selected.comparison.equal -and $Selected.deterministic -and $Selected.cleanup);expectedTLSHash=$Pins['actual-bound-release/operator-package/PR36-TLS-CARRY.json'];originalGeneratorChanged=$false;originalModuleChanged=$false;candidateProductionUseAuthorized=$false;generatorInvocations=0;newTemporalScopes=0;protectedOperations=0}
}
Export-ModuleMember -Function *-NyraTls*
