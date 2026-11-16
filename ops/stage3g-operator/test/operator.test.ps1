#requires -Version 5.1
param([switch]$RequireDesktop)
$ErrorActionPreference='Stop'
if($RequireDesktop -and ($PSVersionTable.PSVersion.Major -ne 5 -or $PSVersionTable.PSEdition -ne 'Desktop')){throw 'NATIVE_WINDOWS_POWERSHELL_51_REQUIRED'}
$HomePath=Split-Path $PSScriptRoot -Parent
Import-Module (Join-Path $HomePath 'NyraOperator.psm1') -Force -DisableNameChecking
$Temp=Join-Path ([IO.Path]::GetTempPath()) ('nyra-offline-tests-'+[guid]::NewGuid().ToString('N'))
$null=New-Item -ItemType Directory -Path $Temp
$script:Tests=0
function Check([string]$Name,[scriptblock]$Block){& $Block;$script:Tests++;Write-Output ('PASS '+$Name)}
function Deny([scriptblock]$Block,[string]$Code){$Failed=$false;try{& $Block|Out-Null}catch{$Failed=$_.Exception.Message -like ('*'+$Code+'*')};Assert-Nyra $Failed ('EXPECTED_DENIAL_'+$Code)}
try{
Check 'all production PowerShell files parse on actual test runtime' {
 foreach($File in (Get-ChildItem -LiteralPath $HomePath -File -Recurse|Where-Object {$_.Extension -in @('.ps1','.psm1')})){$T=$null;$E=$null;$null=[Management.Automation.Language.Parser]::ParseFile($File.FullName,[ref]$T,[ref]$E);Assert-Nyra ($E.Count -eq 0) 'PARSE_ERROR'}
}
Check 'complete manifest and tamper rejection' {
 $P=Join-Path $Temp 'manifest';$null=New-Item -ItemType Directory -Path $P
 [IO.File]::WriteAllText((Join-Path $P 'a.txt'),'synthetic')
 [IO.File]::WriteAllText((Join-Path $P 'SHA256SUMS'),(Get-NyraHash (Join-Path $P 'a.txt'))+'  a.txt'+"`n")
 Assert-Nyra ((Test-NyraManifest $P) -eq 1) 'MANIFEST_POSITIVE'
 [IO.File]::WriteAllText((Join-Path $P 'a.txt'),'tampered');Deny {Test-NyraManifest $P} 'MANIFEST_HASH'
}
Check 'unmanifested file rejection' {
 $P=Join-Path $Temp 'extra';$null=New-Item -ItemType Directory -Path $P
 [IO.File]::WriteAllText((Join-Path $P 'SHA256SUMS'),'');[IO.File]::WriteAllText((Join-Path $P 'extra.txt'),'extra')
 Deny {Test-NyraManifest $P} 'UNMANIFESTED_FILE'
}
Check 'secret export rejected' {Deny {Write-NyraJson (Join-Path $Temp 'secret.json') @{x='-----BEGIN PRIVATE KEY-----'}} 'SECRET_IN_EXPORT'}
Check 'reservation survives uncertain result and never retries' {
 $S=[pscustomobject]@{attempts=[pscustomobject]@{}};$Counter=@{calls=0;saved=0}
 $Persist={param($X)$Counter.saved++}.GetNewClosure();$Run={$Counter.calls++;throw 'SYNTHETIC_UNCERTAIN'}.GetNewClosure()
 Deny {Invoke-NyraOnce $S 'G08' $Persist $Run} 'SYNTHETIC_UNCERTAIN'
 Deny {Invoke-NyraOnce $S 'G08' $Persist $Run} 'PREVIOUS_ATTEMPT'
 Assert-Nyra ($Counter.calls -eq 1 -and $Counter.saved -eq 1) 'DUPLICATE_OPERATION'
}
$Binding=[pscustomobject]@{sourceSHA=('1'*40);treeSHA=('2'*40);targetSHA256=('3'*64);policySHA256=('4'*64);hostExpiresAt=[DateTime]::UtcNow.AddDays(1).ToString('o');ownerKey=@{id='owner';sha256=('5'*64)};brokerKey=@{id='broker';sha256=('6'*64)}}
$Review='7'*64;$Expires=[DateTime]::UtcNow.AddSeconds(899).ToString('o');$Scopes=@{}
foreach($Kind in @('installation','renewal','activation','dispatch')){
 $S=@{schema='nyra.stage3g.discovery-operation-scope.v1';kind=$Kind;resourceId='617219249';mainSHA=$Binding.sourceSHA;treeSHA=$Binding.treeSHA;targetSHA256=$Binding.targetSHA256;executionPolicySHA256=$Binding.policySHA256;reviewSHA256=$Review;approved=$false;nonPublishing=$true;maximumProtectedSeconds=900;startsAt=[DateTime]::UtcNow.AddMinutes(-1).ToString('o');endsAt=[DateTime]::UtcNow.AddMinutes(40).ToString('o');signerPins=@{owner=$Binding.ownerKey;broker=$Binding.brokerKey};ownerDecisionId='decision';ownerDecisionExpiresAt=$Expires;leaseStateSHA256=('8'*64)}
 $Path=Join-Path $Temp ($Kind+'.json');Write-NyraJson $Path $S;$Scopes[$Kind]=@{path=$Path;sha256=(Get-NyraHash $Path)}
}
Check 'exact scope accepted; changed source and expired scope rejected' {
 $null=Assert-NyraScope $Scopes.installation $Binding 'installation' $Review
 $Bad=$Binding|ConvertTo-Json -Depth 10|ConvertFrom-Json;$Bad.sourceSHA='9'*40
 Deny {Assert-NyraScope $Scopes.installation $Bad 'installation' $Review} 'CONCRETE_SCOPE_BINDING'
 $Path=Join-Path $Temp 'expired.json';$S=Get-Content -LiteralPath $Scopes.installation.path -Raw|ConvertFrom-Json;$S.endsAt=[DateTime]::UtcNow.AddSeconds(-1).ToString('o');Write-NyraJson $Path $S
 Deny {Assert-NyraScope @{path=$Path;sha256=(Get-NyraHash $Path)} $Binding 'installation' $Review} 'CONCRETE_SCOPE_WINDOW'
}
foreach($Scenario in @('success','readiness-stop','approval-denied','g07-uncertain','g08-uncertain','g08-reused-lease','g09-synthetic')){
 Check ('bounded sequence '+$Scenario) {
  $Shared=@{calls=(New-Object 'System.Collections.Generic.List[string]');warned=$false;checks=0;dispatch=0}
  $State=[pscustomobject]@{phase='PREPARED';reviewSHA256=$Review;attempts=[pscustomobject]@{}}
  $A=@{
   Readiness={ $Shared.checks++;[pscustomobject]@{readyForSeparateG07Review=($Scenario -ne 'readiness-stop');ownerAAL2='BACKEND_READ_ONLY_VERIFIED';checks=@(@{status='PASS'})} }.GetNewClosure()
   Scope={param($K)$Scopes[$K]}.GetNewClosure()
   Approve={param($S,$K)if($Scenario -eq 'approval-denied'){'bad'}else{$S.sha256}}.GetNewClosure()
   Persist={param($S)}
   Warn={$Shared.warned=$true}.GetNewClosure()
   Run={param($C,$H)
    $Shared.calls.Add($C)
    if(($Scenario -eq 'g07-uncertain' -and $C -eq 'InstallDiscoveryOwner') -or ($Scenario -eq 'g08-uncertain' -and $C -eq 'RenewDiscovery')){throw 'SYNTHETIC_UNCERTAIN'}
    switch($C){
     'InstallDiscoveryOwner' {[pscustomobject]@{marker='NYRA_DISCOVERY_OWNER_AND_CONFIGURATION_INSTALLED';phase='OWNER_AUTHORIZED';sourceSHA=$Binding.sourceSHA;reviewSHA256=$Review;ownerDecision=@{decisionId='decision';expiresAt=$Expires}}}
     'RenewDiscovery' {[pscustomobject]@{marker='NYRA_DISCOVERY_MATCHING_LEASE_READY';phase='LEASE_READY';sourceSHA=$Binding.sourceSHA;resourceId='617219249';reviewSHA256=$Review;renewalResult=@{status=if($Scenario -eq 'g08-reused-lease'){'MATCHING_COMMITTED_LEASE_REUSED'}else{'POSTGRESQL_RENEWAL_COMMITTED'}};nextScope=@{scope=@{kind='activation';leaseStateSHA256=('8'*64)}};roleValidUntil=[DateTime]::UtcNow.AddMinutes(40).ToString('o');publicationPerformed=$false;dispatchPerformed=$false}}
     'ActivateDiscovery' {[pscustomobject]@{marker='NYRA_DISCOVERY_RUNTIME_READY'}}
     'ReserveDiscoveryDispatch' {[pscustomobject]@{marker='NYRA_DISCOVERY_ONE_OWNER_DISPATCH_RESERVED';dispatchPerformed=$false}}
     'CloseDiscovery' {[pscustomobject]@{marker='NYRA_DISCOVERY_SCOPED_SERVICES_CLOSED';services=[pscustomobject]@{owner='inactive';runtime='inactive';caddy='inactive'}}}
    }
   }.GetNewClosure()
   OwnerDispatch={param($R)$Shared.dispatch++}.GetNewClosure()
   Verify={param($R)[pscustomobject]@{marker=if($Scenario -eq 'g09-synthetic'){'SYNTHETIC_PASS'}else{'NYRA_DISCOVERY_SIGNED_EVIDENCE_VERIFIED'};sourceSHA=$Binding.sourceSHA;reviewSHA256=$Review;brokerSignedZeroActiveVerified=$true;publicationPerformed=$false;discovery=@{status='PASS';ownerDecisionVerified=$true;brokerRetirementVerified=$true;runAttempt='1';signedObservations=@(@{role='build'},@{role='inspection'},@{role='publication'});githubRun=@{head_sha=$Binding.sourceSHA;conclusion='success'}}}}.GetNewClosure()
  }
  switch($Scenario){
   'success' {$R=Invoke-NyraProtectedSequence $State $Binding $A;Assert-Nyra ($R.marker -ceq 'NYRA_G08_G09_NATIVE_PASS' -and $Shared.calls.Count -eq 5 -and $Shared.dispatch -eq 1 -and $Shared.checks -eq 2 -and $Shared.warned) 'SEQUENCE_FAILED'}
   'readiness-stop' {Deny {Invoke-NyraProtectedSequence $State $Binding $A} 'PRE_ACTIVATION_READINESS_STOP';Assert-Nyra ($Shared.calls.Count -eq 0 -and !$Shared.warned) 'ACTIVATED_BEFORE_READINESS'}
   'approval-denied' {Deny {Invoke-NyraProtectedSequence $State $Binding $A} 'G07_APPROVAL_REQUIRED';Assert-Nyra ($Shared.calls.Count -eq 0) 'UNAPPROVED_OPERATION'}
   'g07-uncertain' {Deny {Invoke-NyraProtectedSequence $State $Binding $A} 'SYNTHETIC_UNCERTAIN';Assert-Nyra ($Shared.calls.Count -eq 1) 'CONTINUED_AFTER_G07_STOP'}
   'g08-uncertain' {Deny {Invoke-NyraProtectedSequence $State $Binding $A} 'SYNTHETIC_UNCERTAIN';Assert-Nyra ($Shared.calls.Count -eq 2) 'CONTINUED_AFTER_UNCERTAIN_COMMIT'}
   'g08-reused-lease' {Deny {Invoke-NyraProtectedSequence $State $Binding $A} 'G08_COMMIT_AND_JOURNAL_PROOF_REQUIRED';Assert-Nyra ($Shared.calls.Count -eq 2) 'DUPLICATE_RENEWAL_OR_G09'}
   'g09-synthetic' {Deny {Invoke-NyraProtectedSequence $State $Binding $A} 'G09_SIGNED_NATIVE_PROOF_REQUIRED'}
  }
 }
}
Write-Output (ConvertTo-Json @{marker='NYRA_OFFLINE_OPERATOR_TESTS_PASS';tests=$script:Tests;PSVersion=$PSVersionTable.PSVersion.ToString();PSEdition=$PSVersionTable.PSEdition;hostCalls=0;protectedOperations=0})
}finally{Remove-Item -LiteralPath $Temp -Recurse -Force}
