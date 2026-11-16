#requires -Version 5.1
Set-StrictMode -Version 2
$ErrorActionPreference='Stop'
function Assert-Nyra($Value,[string]$Code) { if (!$Value) {throw $Code} }
function Get-NyraHash([string]$Path) { (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant() }
function Get-NyraTextHash([string]$Text) {
    $H=[Security.Cryptography.SHA256]::Create()
    try {([BitConverter]::ToString($H.ComputeHash([Text.Encoding]::UTF8.GetBytes($Text)))).Replace('-','').ToLowerInvariant()} finally {$H.Dispose()}
}
function Write-NyraJson([string]$Path,$Value) {
    $Text=($Value|ConvertTo-Json -Depth 100)+"`n"
    Assert-Nyra ($Text -notmatch '-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|sb_secret_|eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.') 'SECRET_IN_EXPORT'
    $Temp=$Path+'.'+[guid]::NewGuid().ToString('N')
    [IO.File]::WriteAllText($Temp,$Text,(New-Object Text.UTF8Encoding($false)))
    Move-Item -LiteralPath $Temp -Destination $Path -Force
}
function Test-NyraManifest([string]$Directory,[string]$Name='SHA256SUMS') {
    $Seen=@{};$Root=[IO.Path]::GetFullPath($Directory)
    foreach($Line in (Get-Content -LiteralPath (Join-Path $Root $Name))) {
        Assert-Nyra ($Line -cmatch '^([a-f0-9]{64})  ([A-Za-z0-9._/-]+)$') 'MANIFEST_FORMAT'
        $Hash=$Matches[1];$File=$Matches[2]
        Assert-Nyra (!$Seen.ContainsKey($File) -and !$File.StartsWith('/') -and $File -notmatch '(^|/)\.{1,2}(/|$)') 'MANIFEST_PATH'
        $Seen[$File]=$true;$Path=Join-Path $Root $File
        $Item=Get-Item -LiteralPath $Path
        Assert-Nyra (($Item.Attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0 -and !$Item.PSIsContainer) 'MANIFEST_FILE_TYPE'
        Assert-Nyra ((Get-NyraHash $Path) -ceq $Hash) 'MANIFEST_HASH'
    }
    $All=@(Get-ChildItem -LiteralPath $Root -Recurse -File)
    Assert-Nyra ($All.Count -eq $Seen.Count+1) 'UNMANIFESTED_FILE'
    return $Seen.Count
}
function Read-NyraGitHub([string]$Path) {
    Assert-Nyra ($Path -match '^/[A-Za-z0-9/_.?=&-]+$' -and $Path -notmatch '\.\.') 'GITHUB_READ_PATH'
    Invoke-RestMethod -Method Get -Uri ('https://api.github.com/repos/Noctua76/eliaskalyvas-website'+$Path) -Headers @{Accept='application/vnd.github+json';'X-GitHub-Api-Version'='2022-11-28'} -TimeoutSec 20
}
function Get-NyraRelease {
    $P=Read-NyraGitHub '/pulls/36';$M=Read-NyraGitHub '/branches/main'
    Assert-Nyra ($P.head.sha -ceq '225b1bc946b5626e9105f24afd644467852a91af' -and $P.base.sha -ceq '8b82cc964bdbc1919caf91c2669ca154204c025d' -and $P.head.repo.id -eq 1389733212) 'PR36_APPROVED_PINS_CHANGED'
    if (!$P.merged) {
        Assert-Nyra ($M.commit.sha -ceq $P.base.sha) 'MAIN_MOVED_BEFORE_MERGE'
        return [pscustomobject]@{merged=$false;approvedBase=$P.base.sha;approvedHead=$P.head.sha;sourceSHA=$null}
    }
    $C=Read-NyraGitHub ('/git/commits/'+$P.merge_commit_sha)
    Assert-Nyra ($M.commit.sha -ceq $P.merge_commit_sha -and $C.tree.sha -ceq '8fdac1689db7d0d2172481c4eb446bb20be18962' -and $C.parents.Count -eq 2 -and $C.parents[0].sha -ceq $P.base.sha -and $C.parents[1].sha -ceq $P.head.sha) 'ACTUAL_MERGE_BINDING'
    [pscustomobject]@{merged=$true;approvedBase=$P.base.sha;approvedHead=$P.head.sha;sourceSHA=$C.sha;treeSHA=$C.tree.sha;parents=@($C.parents[0].sha,$C.parents[1].sha);observedAt=[DateTime]::UtcNow.ToString('o')}
}
function Confirm-NyraScope($Scope,[string]$Kind,[string]$ReceiptDirectory) {
    $Hash=Get-NyraHash $Scope.path
    Assert-Nyra ($Hash -ceq $Scope.sha256) 'APPROVAL_SCOPE_HASH'
    Write-Host ('OWNER_APPROVAL_REQUIRED: '+$Kind+' SHA256='+$Hash)
    Write-Host ('SCOPE_FILE='+$Scope.path)
    $Expected='APPROVE '+$Kind+' '+$Hash
    Assert-Nyra ((Read-Host $Expected) -ceq $Expected) 'EXPLICIT_OWNER_APPROVAL_REQUIRED'
    Write-NyraJson (Join-Path $ReceiptDirectory ('approval-'+$Kind+'-'+$Hash+'.json')) @{kind=$Kind;scopeSHA256=$Hash;approvedAt=[DateTime]::UtcNow.ToString('o');recordType='local-explicit-operator-acknowledgment';cryptographicOwnerSignature=$false;backendAAL2StillRequired=$true}
    return $Hash
}
function Assert-NyraScope($Scope,$Binding,[string]$Kind,[string]$Review) {
    Assert-Nyra ($Scope.sha256 -cmatch '^[a-f0-9]{64}$' -and (Get-NyraHash $Scope.path) -ceq $Scope.sha256) 'CONCRETE_SCOPE_HASH'
    $S=Get-Content -LiteralPath $Scope.path -Raw|ConvertFrom-Json
    Assert-Nyra ($S.schema -ceq 'nyra.stage3g.discovery-operation-scope.v1' -and $S.kind -ceq $Kind -and $S.resourceId -ceq '617219249' -and $S.mainSHA -ceq $Binding.sourceSHA -and $S.treeSHA -ceq $Binding.treeSHA -and $S.targetSHA256 -ceq $Binding.targetSHA256 -and $S.executionPolicySHA256 -ceq $Binding.policySHA256 -and $S.reviewSHA256 -ceq $Review -and $S.approved -eq $false -and $S.nonPublishing -eq $true -and $S.maximumProtectedSeconds -eq 900) 'CONCRETE_SCOPE_BINDING'
    Assert-Nyra ([DateTimeOffset]::Parse($S.startsAt) -le [DateTimeOffset]::UtcNow -and [DateTimeOffset]::Parse($S.endsAt) -gt [DateTimeOffset]::UtcNow -and [DateTimeOffset]::Parse($S.endsAt) -le [DateTimeOffset]::Parse($Binding.hostExpiresAt)) 'CONCRETE_SCOPE_WINDOW'
    Assert-Nyra ($S.signerPins.owner.id -ceq $Binding.ownerKey.id -and $S.signerPins.owner.sha256 -ceq $Binding.ownerKey.sha256 -and $S.signerPins.broker.id -ceq $Binding.brokerKey.id -and $S.signerPins.broker.sha256 -ceq $Binding.brokerKey.sha256) 'CONCRETE_SIGNER_BINDING'
    return $S
}
function Invoke-NyraOnce($State,[string]$Name,[scriptblock]$Persist,[scriptblock]$Operation) {
    Assert-Nyra (!$State.attempts.PSObject.Properties[$Name]) 'PREVIOUS_ATTEMPT_REQUIRES_READ_ONLY_RECONCILIATION'
    $State.attempts|Add-Member -NotePropertyName $Name -NotePropertyValue 'RESERVED_BEFORE_CALL'
    & $Persist $State
    # An exception or interrupted process deliberately leaves the reservation intact.
    $Result=& $Operation
    $State.attempts.$Name='RETURNED_REQUIRES_VERIFICATION'; & $Persist $State
    return $Result
}
function Assert-NyraG08($Result,$Binding,[string]$Review) {
    Assert-Nyra ($Result.marker -ceq 'NYRA_DISCOVERY_MATCHING_LEASE_READY' -and $Result.phase -ceq 'LEASE_READY' -and $Result.sourceSHA -ceq $Binding.sourceSHA -and $Result.reviewSHA256 -ceq $Review -and $Result.resourceId -ceq '617219249') 'G08_NATIVE_BINDING'
    Assert-Nyra ($Result.renewalResult.status -ceq 'POSTGRESQL_RENEWAL_COMMITTED' -and $Result.nextScope.scope.leaseStateSHA256 -cmatch '^[a-f0-9]{64}$' -and $Result.nextScope.scope.kind -ceq 'activation' -and [DateTimeOffset]::Parse($Result.roleValidUntil) -gt [DateTimeOffset]::UtcNow) 'G08_COMMIT_AND_JOURNAL_PROOF_REQUIRED'
    Assert-Nyra ($Result.publicationPerformed -eq $false -and $Result.dispatchPerformed -eq $false) 'G08_UNEXPECTED_SIDE_EFFECT'
}
function Assert-NyraG09($Result,$Binding,[string]$Review) {
    Assert-Nyra ($Result.marker -ceq 'NYRA_DISCOVERY_SIGNED_EVIDENCE_VERIFIED' -and $Result.sourceSHA -ceq $Binding.sourceSHA -and $Result.reviewSHA256 -ceq $Review -and $Result.brokerSignedZeroActiveVerified -eq $true -and $Result.discovery.status -ceq 'PASS' -and $Result.discovery.ownerDecisionVerified -eq $true -and $Result.discovery.brokerRetirementVerified -eq $true -and $Result.discovery.runAttempt -eq '1') 'G09_SIGNED_NATIVE_PROOF_REQUIRED'
    Assert-Nyra ((@($Result.discovery.signedObservations.role|Sort-Object) -join ',') -ceq 'build,inspection,publication' -and $Result.discovery.githubRun.head_sha -ceq $Binding.sourceSHA -and $Result.discovery.githubRun.conclusion -ceq 'success' -and $Result.publicationPerformed -eq $false) 'G09_REAL_THREE_ROLE_RUN_REQUIRED'
}
function Invoke-NyraProtectedSequence($State,$Binding,$Adapters) {
    # Adapter injection is for independently testable functions, never a CLI bypass.
    Assert-Nyra ($State.phase -in @('PREPARED','OWNER_AUTHORIZED','G08_PASS','RUNTIME_READY','DISPATCH_RESERVED')) 'RESUME_REQUIRES_READ_ONLY_RECONCILIATION'
    if($State.phase -cne 'PREPARED') {
        $Native=& $Adapters.Status
        $Expected=@{OWNER_AUTHORIZED='OWNER_AUTHORIZED';G08_PASS='LEASE_READY';RUNTIME_READY='RUNTIME_READY';DISPATCH_RESERVED='DISPATCH_RESERVED'}[$State.phase]
        Assert-Nyra ($Native.marker -ceq 'NYRA_DISCOVERY_STATUS' -and $Native.phase -ceq $Expected -and $Native.sourceSHA -ceq $Binding.sourceSHA -and $Native.reviewSHA256 -ceq $State.reviewSHA256) 'NATIVE_RESUME_RECONCILIATION_FAILED'
    }
    if($State.phase -ceq 'PREPARED') {
    $Ready=& $Adapters.Readiness
    Assert-Nyra ($Ready.readyForSeparateG07Review -eq $true -and $Ready.ownerAAL2 -ceq 'BACKEND_READ_ONLY_VERIFIED' -and $Ready.checks.Count -gt 0 -and @($Ready.checks|Where-Object {$_.status -cne 'PASS'}).Count -eq 0) 'PRE_ACTIVATION_READINESS_STOP'
    $G07Scope=& $Adapters.Scope 'installation'
    $null=Assert-NyraScope $G07Scope $Binding 'installation' $State.reviewSHA256
    $G07Approval=& $Adapters.Approve $G07Scope 'G07'
    Assert-Nyra ($G07Approval -ceq $G07Scope.sha256) 'G07_APPROVAL_REQUIRED'
    # Revalidate after the approval pause; expired margins cannot start the timer.
    $Ready=& $Adapters.Readiness
    Assert-Nyra ($Ready.readyForSeparateG07Review -eq $true) 'PRE_ACTIVATION_MARGIN_EXPIRED'
    & $Adapters.Warn
    $G07=Invoke-NyraOnce $State 'G07' $Adapters.Persist {& $Adapters.Run 'InstallDiscoveryOwner' $G07Approval}
    Assert-Nyra ($G07.marker -ceq 'NYRA_DISCOVERY_OWNER_AND_CONFIGURATION_INSTALLED' -and $G07.phase -ceq 'OWNER_AUTHORIZED' -and $G07.sourceSHA -ceq $Binding.sourceSHA -and $G07.reviewSHA256 -ceq $State.reviewSHA256) 'G07_NATIVE_BINDING'
        $State|Add-Member -NotePropertyName verifiedG07 -NotePropertyValue $G07 -Force
        $State.phase='OWNER_AUTHORIZED'; & $Adapters.Persist $State
    } else {$G07=$State.verifiedG07}
    if($State.phase -ceq 'OWNER_AUTHORIZED') {
    $G08Scope=& $Adapters.Scope 'renewal';$S=Assert-NyraScope $G08Scope $Binding 'renewal' $State.reviewSHA256
    Assert-Nyra ($S.ownerDecisionId -ceq $G07.ownerDecision.decisionId -and $S.ownerDecisionExpiresAt -ceq $G07.ownerDecision.expiresAt) 'G08_OWNER_DECISION_BINDING'
    $G08Approval=& $Adapters.Approve $G08Scope 'G08'
    Assert-Nyra ($G08Approval -ceq $G08Scope.sha256) 'G08_APPROVAL_REQUIRED'
    Assert-Nyra ([DateTimeOffset]::Parse($S.ownerDecisionExpiresAt) -gt [DateTimeOffset]::UtcNow.AddSeconds(600)) 'OWNER_DECISION_MARGIN_UNDER_600_SECONDS'
    $G08=Invoke-NyraOnce $State 'G08' $Adapters.Persist {& $Adapters.Run 'RenewDiscovery' $G08Approval}
    Assert-NyraG08 $G08 $Binding $State.reviewSHA256
        $State|Add-Member -NotePropertyName verifiedG08 -NotePropertyValue $G08 -Force
        $State.phase='G08_PASS'; & $Adapters.Persist $State
    } else {
        $G08=$State.verifiedG08;Assert-NyraG08 $G08 $Binding $State.reviewSHA256
        if($State.phase -cne 'DISPATCH_RESERVED'){Assert-Nyra ($Native.nextScope.scope.leaseStateSHA256 -ceq $G08.nextScope.scope.leaseStateSHA256) 'NATIVE_RESUME_LEASE_CHANGED'}
    }
    $A=& $Adapters.Scope 'activation';$null=Assert-NyraScope $A $Binding 'activation' $State.reviewSHA256
    if($State.phase -ceq 'G08_PASS') {
    $Approval=& $Adapters.Approve $A 'G09_ACTIVATION'
    Assert-Nyra ($Approval -ceq $A.sha256) 'ACTIVATION_APPROVAL_REQUIRED'
    $Activated=Invoke-NyraOnce $State 'G09_ACTIVATION' $Adapters.Persist {& $Adapters.Run 'ActivateDiscovery' $Approval}
    Assert-Nyra ($Activated.marker -ceq 'NYRA_DISCOVERY_RUNTIME_READY') 'G09_RUNTIME_NOT_READY'
    $State.phase='RUNTIME_READY'; & $Adapters.Persist $State
    }
    $D=& $Adapters.Scope 'dispatch';$null=Assert-NyraScope $D $Binding 'dispatch' $State.reviewSHA256
    if($State.phase -ceq 'RUNTIME_READY'){
    $Approval=& $Adapters.Approve $D 'G09_DISPATCH_RESERVATION'
    Assert-Nyra ($Approval -ceq $D.sha256) 'DISPATCH_APPROVAL_REQUIRED'
    $Reserved=Invoke-NyraOnce $State 'G09_DISPATCH_RESERVATION' $Adapters.Persist {& $Adapters.Run 'ReserveDiscoveryDispatch' $Approval}
    Assert-Nyra ($Reserved.marker -ceq 'NYRA_DISCOVERY_ONE_OWNER_DISPATCH_RESERVED' -and $Reserved.dispatchPerformed -eq $false) 'G09_RESERVATION_BINDING'
    $State|Add-Member -NotePropertyName verifiedReservation -NotePropertyValue $Reserved -Force
    $State.phase='DISPATCH_RESERVED'; & $Adapters.Persist $State
    } else {$Reserved=$State.verifiedReservation}
    if(!$State.PSObject.Properties['ownerHandoffShown']) {
        $State|Add-Member -NotePropertyName ownerHandoffShown -NotePropertyValue $true
        & $Adapters.Persist $State
        & $Adapters.OwnerDispatch $Reserved
    }
    $Result=& $Adapters.Verify $Reserved
    Assert-NyraG09 $Result $Binding $State.reviewSHA256
    $State.phase='G09_PASS'; & $Adapters.Persist $State
    # Closing is covered by the already approved operation-owned activation scope.
    $Closed=Invoke-NyraOnce $State 'CLOSE' $Adapters.Persist {& $Adapters.Run 'CloseDiscovery' $A.sha256}
    Assert-Nyra ($Closed.marker -ceq 'NYRA_DISCOVERY_SCOPED_SERVICES_CLOSED' -and @($Closed.services.PSObject.Properties|Where-Object {$_.Value -cne 'inactive'}).Count -eq 0) 'G09_CLEANUP_NOT_VERIFIED'
    return [pscustomobject]@{marker='NYRA_G08_G09_NATIVE_PASS';G08=$G08;G09=$Result;closed=$Closed;G10='PENDING_INDEPENDENT_ACCEPTANCE'}
}
Export-ModuleMember -Function *-Nyra*
