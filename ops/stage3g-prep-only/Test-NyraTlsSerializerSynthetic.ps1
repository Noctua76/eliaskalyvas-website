#requires -Version 5.1
param([Parameter(Mandatory=$true)][string]$OriginalModule,[Parameter(Mandatory=$true)][string]$OriginalGenerator)
$ErrorActionPreference='Stop'
Import-Module (Join-Path $PSScriptRoot 'NyraTlsCompatibility.psm1') -Force -DisableNameChecking
$Temp=Join-Path ([IO.Path]::GetTempPath()) ('nyra-tls-synthetic-'+[guid]::NewGuid().ToString('N'))
$null=New-Item -ItemType Directory -Path $Temp
$script:Checks=0
function Check([string]$Name,[scriptblock]$Body){& $Body;$script:Checks++;Write-Host ('PASS '+$Name)}
function Denied([string]$Name,[scriptblock]$Body){$Failed=$false;try{& $Body|Out-Null}catch{$Failed=$true};Assert-NyraTls $Failed ('NOT_REJECTED_'+$Name);$script:Checks++;Write-Host ('PASS reject '+$Name)}
try{
 foreach($Name in @('NyraTlsCompatibility.psm1','Test-NyraTlsCompatibility.ps1','NyraPreparationOnly.psm1','Prepare-NyraV17Offline.ps1')){$null=Get-NyraTlsAst (Join-Path $PSScriptRoot $Name)}
 Check 'changed-source-parser' {}
 Assert-NyraTlsFilePin $OriginalModule 'e81e526b146d3d63e11ee15ba36433bb013c9dcd9b7223edc8166970fc2309df'
 Assert-NyraTlsFilePin $OriginalGenerator '9390b98db93e66afc7e53e5dc3cfc182a65c7bec0c62d8f9e1193d86194ea82e'
 Check 'original-public-source-pins' {}
 $WriterText=Get-NyraTlsWriterText (Get-NyraTlsAst $OriginalModule)
 $Candidate=Get-NyraTlsReviewCandidateText $WriterText
 $Value=[ordered]@{name='synthetic';source='source-fixture';target='target-fixture';signer='signer-fixture';nested=[ordered]@{z=1;a=$false};paths=@('public/a','public/b');text='quote"slash\';count=0}
 $RefPath=Join-Path $PSScriptRoot 'synthetic-reference.json';$Reference=[IO.File]::ReadAllBytes($RefPath)
 Assert-NyraTlsFilePin $RefPath 'd68b1f37b2cbcc70d000499252c2aaf74372214a3381dfe220b9ff1660ab85c4'
 $Original=Invoke-NyraTlsWriterProbe $Reference $Value $WriterText (Join-Path $Temp 'original')
 Check 'original-writer-determinism-cleanup' {Assert-NyraTls ($Original.deterministic -and $Original.cleanup) 'ORIGINAL_DETERMINISM'}
 Write-Host ('SANITIZED_ORIGINAL_WRITER='+($Original|ConvertTo-Json -Compress -Depth 15))
 $IsCore770=$PSVersionTable.PSEdition -ceq 'Core' -and $PSVersionTable.PSVersion -eq [version]'7.7.0'
 if($IsCore770){
  $Fixed=Invoke-NyraTlsWriterProbe $Reference $Value $Candidate (Join-Path $Temp 'candidate')
  Check 'review-candidate-exact-bytes' {Assert-NyraTls ($Fixed.comparison.equal -and $Fixed.deterministic -and $Fixed.cleanup) 'CANDIDATE_BYTES'}
  Write-Host ('SANITIZED_REVIEW_CANDIDATE='+($Fixed|ConvertTo-Json -Compress -Depth 15))
  $Reordered=[ordered]@{source=$Value.source;name=$Value.name;target=$Value.target;signer=$Value.signer;nested=$Value.nested;paths=$Value.paths;text=$Value.text;count=$Value.count}
  $WrongOrder=Invoke-NyraTlsWriterProbe $Reference $Reordered $Candidate (Join-Path $Temp 'order')
  Check 'field-order-mismatch-not-compatible' {Assert-NyraTls (!$WrongOrder.comparison.equal -and $WrongOrder.comparison.category -ceq 'FIELD_ORDER') 'ORDER_ACCEPTED'}
  foreach($Field in @('source','target','signer')){
   $Changed=[ordered]@{};foreach($K in $Value.Keys){$Changed[$K]=$Value[$K]};$Changed[$Field]='changed-fixture'
   $Bad=Invoke-NyraTlsWriterProbe $Reference $Changed $Candidate (Join-Path $Temp $Field)
   Check ('changed-'+$Field+'-not-compatible') {Assert-NyraTls (!$Bad.comparison.equal) 'VALUE_ACCEPTED'}
  }
 }else{
  Denied 'incompatible-runtime-candidate' {Invoke-NyraTlsWriterProbe $Reference $Value $Candidate (Join-Path $Temp 'unsupported')}
  Check 'incompatible-runtime-cleanup' {Assert-NyraTls (!(Test-Path -LiteralPath (Join-Path $Temp 'unsupported'))) 'LEAK'}
 }
 Denied 'wrong-reference-hash' {Assert-NyraTlsFilePin $RefPath ('0'*64)}
 $CRLF=[Text.Encoding]::UTF8.GetBytes(([Text.Encoding]::UTF8.GetString($Reference)).Replace("`n","`r`n"))
 Check 'newline-mismatch-rejected' {Assert-NyraTls (!(Compare-NyraTlsBytes $Reference $CRLF).equal) 'NEWLINE_ACCEPTED'}
 $BOM=[byte[]](@(239,187,191)+@($Reference))
 Check 'encoding-mismatch-rejected' {Assert-NyraTls (!(Compare-NyraTlsBytes $Reference $BOM).equal) 'BOM_ACCEPTED'}
 $Altered=Join-Path $Temp 'altered.json';[IO.File]::WriteAllText($Altered,'changed')
 Denied 'altered-input-pin' {Assert-NyraTlsFilePin $Altered (Get-NyraTlsBytesHash $Reference)}
 Denied 'missing-input' {Assert-NyraTlsFilePin (Join-Path $Temp 'missing.json') (Get-NyraTlsBytesHash $Reference)}
 $Existing=Join-Path $Temp 'existing';$null=New-Item -ItemType Directory -Path $Existing
 $Sentinel=Join-Path $Existing 'sentinel';[IO.File]::WriteAllText($Sentinel,'keep')
 Denied 'existing-output' {Invoke-NyraTlsWriterProbe $Reference $Value $WriterText $Existing}
 Check 'predecessor-output-preserved' {Assert-NyraTls ([IO.File]::ReadAllText($Sentinel) -ceq 'keep') 'OVERWRITE'}
 # The full synthetic script contains a fatal sentinel. Only five assignments run.
 $Fixture=Join-Path $Temp 'synthetic-generator.ps1'
 $FixtureText='$B="base-fixture";$H="head-fixture";$T="tree-fixture";$Natives=[ordered]@{a="native-fixture"};$C=[ordered]@{source=$R.source;tree=$T;parents=@($B,$H);native=$Natives};throw "FULL_GENERATOR_MUST_NEVER_RUN"'
 [IO.File]::WriteAllText($Fixture,$FixtureText)
 $Built=New-NyraTlsOrderedObject (Get-NyraTlsAst $Fixture) ([pscustomobject]@{source='source-fixture'})
 Check 'exact-ordered-assignment-reconstruction-without-full-generator' {Assert-NyraTls (($Built.Keys -join ',') -ceq 'source,tree,parents,native' -and $Built.source -ceq 'source-fixture' -and ($Built.parents -join ',') -ceq 'base-fixture,head-fixture') 'RECONSTRUCTION'}
 $MissingState=Join-Path $Temp 'missing-state.json'
 $Shell=if($PSVersionTable.PSEdition -ceq 'Desktop'){Join-Path $PSHOME 'powershell.exe'}elseif([Environment]::OSVersion.Platform -eq [PlatformID]::Win32NT){Join-Path $PSHOME 'pwsh.exe'}else{Join-Path $PSHOME 'pwsh'}
 $Output=& $Shell -NoLogo -NoProfile -NonInteractive -File (Join-Path $PSScriptRoot 'Test-NyraTlsCompatibility.ps1') -WorkDirectory $Temp -StatePath $MissingState 2>&1
 $Code=$LASTEXITCODE
 Check 'entrypoint-fail-closed-no-ready' {Assert-NyraTls ($Code -ne 0 -and ($Output -join "`n") -match 'SERIALIZER_COMPATIBILITY_STOP' -and ($Output -join "`n") -notmatch 'SERIALIZER_COMPATIBILITY_PASS') 'ENTRYPOINT_FAIL_OPEN'}
 Write-Host ('NYRA_TLS_SYNTHETIC_PASS; CHECKS='+$script:Checks+'; POWERSHELL='+$PSVersionTable.PSVersion.ToString()+'; EDITION='+$PSVersionTable.PSEdition+'; GENERATOR_INVOCATIONS=0; NEW_SCOPES=0')
}finally{if(Test-Path -LiteralPath $Temp){Remove-Item -LiteralPath $Temp -Recurse -Force}}
Assert-NyraTls (!(Test-Path -LiteralPath $Temp)) 'SYNTHETIC_CLEANUP_FAILED'
Write-Host 'NYRA_TLS_SYNTHETIC_CLEANUP_PASS'
