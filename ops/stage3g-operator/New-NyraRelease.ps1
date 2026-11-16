#requires -Version 5.1
param([Parameter(Mandatory=$true)][string]$BaselinePackage,[Parameter(Mandatory=$true)][string]$ReleaseReceipt,[Parameter(Mandatory=$true)][string]$OutputDirectory)
$ErrorActionPreference='Stop'
Import-Module (Join-Path $PSScriptRoot 'NyraOperator.psm1') -Force -DisableNameChecking
$R=Get-Content -LiteralPath $ReleaseReceipt -Raw|ConvertFrom-Json
$B='8b82cc964bdbc1919caf91c2669ca154204c025d';$H='225b1bc946b5626e9105f24afd644467852a91af';$T='8fdac1689db7d0d2172481c4eb446bb20be18962'
Assert-Nyra ($R.merged -eq $true -and $R.sourceSHA -cmatch '^[a-f0-9]{40}$' -and $R.treeSHA -ceq $T -and ($R.parents -join ' ') -ceq ($B+' '+$H)) 'ACTUAL_APPROVED_MERGE_REQUIRED'
$null=Test-NyraManifest $BaselinePackage
Assert-Nyra ((Get-NyraHash (Join-Path $BaselinePackage 'run-stage3g.ps1')) -ceq 'c49fdb3e576d68810303e4662c4f261c7f260052d55d486f284813288a9af25f') 'BASELINE_RUNNER_PIN'
$ManifestExpected=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'baseline-manifest.sha256') -Raw
Assert-Nyra ((Get-NyraHash (Join-Path $BaselinePackage 'SHA256SUMS')) -ceq $ManifestExpected.Trim()) 'ACCEPTED_V14_BASELINE_REQUIRED'
Assert-Nyra (!(Test-Path -LiteralPath $OutputDirectory)) 'SUCCESSOR_DIRECTORY_EXISTS_NO_OVERWRITE'
Assert-Nyra ([DateTimeOffset]::UtcNow.AddHours(4) -lt [DateTimeOffset]::Parse('2026-11-22T19:17:37Z')) 'HOST_RETIREMENT_MARGIN'
$null=New-Item -ItemType Directory -Path $OutputDirectory
$P=Join-Path $OutputDirectory 'operator-package';Copy-Item -LiteralPath $BaselinePackage -Destination $P -Recurse
function Put([string]$Name,[string]$Text){[IO.File]::WriteAllText((Join-Path $P $Name),$Text,(New-Object Text.UTF8Encoding($false)))}
function Read([string]$Name){[IO.File]::ReadAllText((Join-Path $P $Name))}
function Change([string]$Name,[string]$Old,[string]$New){$X=Read $Name;Assert-Nyra ($X.Contains($Old)) ('BINDING_TEMPLATE_MISSING_'+$Name.Replace('.','_'));Put $Name $X.Replace($Old,$New)}
$Now=[DateTimeOffset]::UtcNow;$End=$Now.AddHours(4)
$Natives=[ordered]@{'ops/acceptance-bootstrap/repository-db-renewal.mjs'='376edf2bab73491141fce4be7e3c254250bd90891b169115b7c760723ff8d961';'ops/acceptance-bootstrap/owner-request.mjs'='5d8b2189e5d229e44aa47fb6337ab36ad537c258b2f7ae022cc78aac75aa63f2'}
$C=[ordered]@{schema='nyra.stage3g.pr36.tls-carry-forward.v1';sourceSHA=$R.sourceSHA;treeSHA=$T;parents=@($B,$H);historicalSourceSHA='2779edc75c13b66246957b9ca0aa996d764901bc';previousCarrySHA256='1cba3ff58a7a0d3fb588f3c23f0cde0b14aecc9c13ff18457b00f21c7f05e364';targetSHA256='e02b1039eab7d7f46a3e6a29f69876fd2a8d703da4209e22ceac8d9c27508d1e';resourceId='617219249';hostExpiresAt='2026-11-22T19:17:37Z';nativeSHA256=$Natives;allowedChangedPaths=@('ops/acceptance-bootstrap/owner-request.mjs','ops/acceptance-bootstrap/repository-db-renewal.mjs','test/g08-owner-channel-diagnostics.test.mjs','test/g08-owner-commit-margin.test.mjs','test/nyra-bootstrap-native.test.mjs');historicalReceiptRewritten=$false;DNSOrHTTPSInvocations=0;servicesActivated=$false}
Write-NyraJson (Join-Path $P 'PR36-TLS-CARRY.json') $C
$CarryHash=Get-NyraHash (Join-Path $P 'PR36-TLS-CARRY.json')
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'pr36-tls-carry.mjs') -Destination $P
Change 'pr36-tls-carry.mjs' '__CARRY_SHA256__' $CarryHash
$Policy=Read 'DISCOVERY-EXECUTION-POLICY.json'|ConvertFrom-Json
$OldPolicy=Get-NyraHash (Join-Path $P 'DISCOVERY-EXECUTION-POLICY.json')
$Policy.mainSHA=$R.sourceSHA;$Policy.treeSHA=$T;$Policy.parents=@($B,$H);$Policy.TLSCarryForwardSHA256=$CarryHash
Write-NyraJson (Join-Path $P 'DISCOVERY-EXECUTION-POLICY.json') $Policy
$PolicyHash=Get-NyraHash (Join-Path $P 'DISCOVERY-EXECUTION-POLICY.json')
Change 'discovery-operation.mjs' $OldPolicy $PolicyHash
Change 'discovery-operation.mjs' "from './tls-carry-forward.mjs'" "from './pr36-tls-carry.mjs'"
# Additional readiness predicates are read-only. Native source/security gates stay unchanged.
$Readiness="  signedJournalIntegrity:async()=>{await readSignedDecision(c);},`n  stagedCredentialAbsence:async()=>{for(const r of ['registrar','broker'])check(!(await readdir('/var/lib/nyra-5c/'+r)).some(n=>n.startsWith('pg.json.nyra-')),'STAGED_CREDENTIAL_REQUIRES_REVIEW');},`n  preparedScopeBinding:async()=>{const o=await readState(d.reviewSHA),s=o.state.scopes?.installation;check(s&&sha(await bytes(o.dir+'/'+s.name))===s.sha256,'CONCRETE_SCOPE_NOT_PREPARED');const q=await json(o.dir+'/'+s.name);check(q.kind==='installation'&&q.reviewSHA256===d.reviewSHA&&q.sessionId===d.session.sessionId&&q.repositoryTrustSHA256===d.review.repositoryTrustSHA256&&q.executionPolicySHA256===POLICY_SHA,'SCOPE_BINDING');},`n"
Change 'discovery-operation.mjs' '  preparedOperation:async()=>' ($Readiness+'  preparedOperation:async()=>')
Change 'discovery-operation.mjs' '"UNKNOWN_DISCOVERY_ACTION"' '"UNKNOWN_DISCOVERY_ACTION", "STAGED_CREDENTIAL_REQUIRES_REVIEW"'
Change 'discovery-step.ps1' "'UNKNOWN_DISCOVERY_ACTION'" "'UNKNOWN_DISCOVERY_ACTION','STAGED_CREDENTIAL_REQUIRES_REVIEW'"
$OldParents='2779edc75c13b66246957b9ca0aa996d764901bc 61ecf2f15ac39d01e382e98420d1ef98af745208'
foreach($Name in @('fresh-administration-pinned.mjs','prepare-owner-launch-pinned.mjs','pin-rollover-readback.mjs')){
 Change $Name $OldParents '__NYRA_PARENTS__'
 Change $Name $B $R.sourceSHA
 Change $Name '6666382d62428e8c61ba5bd558c448cdee5dde24' $T
 Change $Name '__NYRA_PARENTS__' ($B+' '+$H)
}
Change 'prepare-owner-launch-pinned.mjs' "const approvedHead='61ecf2f15ac39d01e382e98420d1ef98af745208'" ("const approvedHead='"+$H+"'")
Change 'capture-current-administration.mjs' $B $R.sourceSHA
Change 'pin-rollover-readback.mjs' "from './tls-carry-forward.mjs'" "from './pr36-tls-carry.mjs'"
# Only release pins/secure in-process bearer supply/staged carry collectors change in the accepted runner.
Change 'run-stage3g.ps1' "    [string]`$ResumeDirectory = ''," "    [Security.SecureString]`$OwnerBearer,`n    [string]`$ResumeDirectory = '',"
Change 'run-stage3g.ps1' "[string]`$ApprovedMergeSHA = '$B'" ("[string]`$ApprovedMergeSHA = '"+$R.sourceSHA+"'")
Change 'run-stage3g.ps1' "`$Baseline = '2779edc75c13b66246957b9ca0aa996d764901bc'" ("`$Baseline = '"+$B+"'")
Change 'run-stage3g.ps1' "`$Head = '61ecf2f15ac39d01e382e98420d1ef98af745208'" ("`$Head = '"+$H+"'")
Change 'run-stage3g.ps1' '6666382d62428e8c61ba5bd558c448cdee5dde24' $T
Change 'run-stage3g.ps1' "'/pulls/35'" "'/pulls/36'"
Change 'run-stage3g.ps1' "'github-pr35.json'" "'github-pr36.json'"
Change 'run-stage3g.ps1' "'tls-carry-forward.mjs','TLS-CARRY-FORWARD.json'" "'tls-carry-forward.mjs','TLS-CARRY-FORWARD.json','pr36-tls-carry.mjs','PR36-TLS-CARRY.json'"
foreach($Name in @('discovery-step.ps1','renewal-recovery-step.ps1')) {
 $Text=Read $Name
 $Text=$Text.Replace("`$Secret = Read-Host 'Fresh Owner AAL2 bearer HERE ONLY (hidden); never paste in ChatGPT' -AsSecureString","`$Secret = if (`$null -ne `$OwnerBearer) {`$OwnerBearer.Copy()} else {Read-Host 'Fresh Owner AAL2 bearer HERE ONLY (hidden); never paste in ChatGPT' -AsSecureString}")
 Put $Name $Text
}
$Admin=Read 'APPROVAL-ADMINISTRATION-AND-DRAFTS.json'|ConvertFrom-Json;$Admin.sourceSHA=$R.sourceSHA;$Admin.treeSHA=$T
Write-NyraJson (Join-Path $P 'APPROVAL-ADMINISTRATION-AND-DRAFTS.json') $Admin
$AdminHash=Get-NyraHash (Join-Path $P 'APPROVAL-ADMINISTRATION-AND-DRAFTS.json')
$Policy.existingAdminPreparationScopeSHA256=$AdminHash
Write-NyraJson (Join-Path $P 'DISCOVERY-EXECUTION-POLICY.json') $Policy
$FinalPolicyHash=Get-NyraHash (Join-Path $P 'DISCOVERY-EXECUTION-POLICY.json')
Change 'discovery-operation.mjs' $PolicyHash $FinalPolicyHash
$PolicyHash=$FinalPolicyHash
$Prep=Read 'OWNER-RENEWAL-RECOVERY-SCOPE.json'|ConvertFrom-Json
$OldPrep=Get-NyraHash (Join-Path $P 'OWNER-RENEWAL-RECOVERY-SCOPE.json')
$Prep.sourceSHA=$R.sourceSHA;$Prep.treeSHA=$T;$Prep.parents=@($B,$H);$Prep.nativeRenewalSHA256=$Natives['ops/acceptance-bootstrap/repository-db-renewal.mjs'];$Prep.administrationPreparationScopeSHA256=$AdminHash;$Prep.notBefore=$Now.ToString('yyyy-MM-ddTHH:mm:ssZ');$Prep.approvalNotAfter=$End.ToString('yyyy-MM-ddTHH:mm:ssZ')
foreach($Property in @($Prep.helperSHA256.PSObject.Properties)){$Prep.helperSHA256.($Property.Name)=Get-NyraHash (Join-Path $P $Property.Name)}
Write-NyraJson (Join-Path $P 'OWNER-RENEWAL-RECOVERY-SCOPE.json') $Prep
$PrepHash=Get-NyraHash (Join-Path $P 'OWNER-RENEWAL-RECOVERY-SCOPE.json')
Change 'renewal-recovery-step.ps1' $OldPrep $PrepHash
$Rows=@(Get-ChildItem -LiteralPath $P -Recurse -File|Where-Object {$_.Name -ne 'SHA256SUMS'}|Sort-Object FullName|ForEach-Object {(Get-NyraHash $_.FullName)+'  '+$_.FullName.Substring($P.Length+1).Replace('\','/')})
[IO.File]::WriteAllLines((Join-Path $P 'SHA256SUMS'),[string[]]$Rows,(New-Object Text.UTF8Encoding($false)))
$null=Test-NyraManifest $P
$Binding=[ordered]@{schema='nyra.stage3g.pr36.bound-release.v1';sourceSHA=$R.sourceSHA;treeSHA=$T;parents=@($B,$H);targetSHA256=$Policy.targetSHA256;hostExpiresAt=$Policy.hostExpiresAt;ownerKey=$Policy.ownerKey;brokerKey=$Policy.brokerKey;policySHA256=$PolicyHash;preparationScopeSHA256=$PrepHash;TLSCarryForwardSHA256=$CarryHash;executionAuthorized=$false;runtimeFiles=64;nativeSHA256=$Natives}
Write-NyraJson (Join-Path $OutputDirectory 'BOUND-RELEASE.json') $Binding
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'pr36-inactive-align.py') -Destination $OutputDirectory
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'runtime-inventory.json') -Destination $OutputDirectory
$Helpers=@{};foreach($Name in @('pr36-inactive-align.py','runtime-inventory.json')){$Helpers[$Name]=Get-NyraHash (Join-Path $OutputDirectory $Name)}
foreach($Name in @('pr36-tls-carry.mjs','PR36-TLS-CARRY.json','tls-carry-forward.mjs','TLS-CARRY-FORWARD.json','tls-checkpoint.mjs','APPROVAL-TLS-ONLY.json','safe-loader.cjs','dns-wire.mjs','pin-rollover-readback.mjs')){$Helpers[$Name]=Get-NyraHash (Join-Path $P $Name)}
$Align=[ordered]@{schema='nyra.stage3g.pr36.inactive-alignment.v1';purpose='inactive-exact-source-and-two-runtime-modules';sourceSHA=$R.sourceSHA;treeSHA=$T;parents=@($B,$H);resourceId='617219249';targetSHA256=$Policy.targetSHA256;hostExpiresAt=$Policy.hostExpiresAt;notBefore=$Prep.notBefore;approvalNotAfter=$Prep.approvalNotAfter;nativeSHA256=$Natives;carryForwardSHA256=$CarryHash;helpers=$Helpers;configurationWrites=0;credentialOperations=0;serviceOperations=0;dispatches=0;providerMutations=0;automaticRetries=0}
Write-NyraJson (Join-Path $OutputDirectory 'ALIGNMENT-SCOPE.json') $Align
$Result=[ordered]@{marker='NYRA_PR36_RELEASE_BOUND_REVIEW_ONLY';binding=$Binding;alignmentScopeSHA256=(Get-NyraHash (Join-Path $OutputDirectory 'ALIGNMENT-SCOPE.json'));preparationScopeSHA256=$PrepHash;carryForwardSHA256=$CarryHash;protectedExecutionAuthorized=$false;hostCalls=0}
Write-NyraJson (Join-Path $OutputDirectory 'BINDING-REPORT.json') $Result
$Result
