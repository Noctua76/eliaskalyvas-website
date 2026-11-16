#requires -Version 5.1
[CmdletBinding()]
param([ValidateSet('Prepare','Continue')][string]$Mode='Prepare',[string]$WorkDirectory=(Join-Path $env:USERPROFILE 'Downloads\nyra-g08g09-controlled'),[string]$PackageRoot=$PSScriptRoot)
$ErrorActionPreference='Stop'
Import-Module (Join-Path $PSScriptRoot 'NyraOperator.psm1') -Force -DisableNameChecking
$null=Test-NyraManifest $PackageRoot 'HANDOFF-SHA256SUMS'
$null=New-Item -ItemType Directory -Path $WorkDirectory -Force
$StatePath=Join-Path $WorkDirectory 'orchestrator-state.json'
$Release=Get-NyraRelease
if (!$Release.merged) {
    $MergeScope=Join-Path $WorkDirectory 'PR36-MERGE-SCOPE.json'
    Write-NyraJson $MergeScope ([ordered]@{schema='nyra.pr36.controlled-merge-scope.v1';repository='Noctua76/eliaskalyvas-website';PR=36;approvedBase=$Release.approvedBase;approvedHead=$Release.approvedHead;expectedTree='8fdac1689db7d0d2172481c4eb446bb20be18962';method='merge';approvedReviewZIP='b05c425aad407fcfcd3396848ae44d8f9b433294dc9b8c112117bfeacb3f7fcf';PagesWorkflow='pages.yml';disableIfEnabledBeforeMerge=$true;restoreOriginalStateAfterMerge=$true;manualDispatch=$false;executionAuthorized=$false})
    Write-Host ('NEXT_GATE=SEPARATE_OWNER_MERGE_APPROVAL; SCOPE_SHA256='+(Get-NyraHash $MergeScope))
    Write-Host 'PR36 remains unmerged. Use the reviewed release procedure; this command never merges.'
    return
}
$ReleasePath=Join-Path $WorkDirectory 'actual-release.json';Write-NyraJson $ReleasePath $Release
$Bound=Join-Path $WorkDirectory ('release-'+$Release.sourceSHA)
if (!(Test-Path -LiteralPath $Bound)) {
    $null=& (Join-Path $PSScriptRoot 'New-NyraRelease.ps1') -BaselinePackage (Join-Path $PackageRoot 'baseline-operator') -ReleaseReceipt $ReleasePath -OutputDirectory $Bound
}
$Binding=Get-Content -LiteralPath (Join-Path $Bound 'BOUND-RELEASE.json') -Raw|ConvertFrom-Json
Assert-Nyra ($Binding.sourceSHA -ceq $Release.sourceSHA) 'BOUND_SOURCE_CHANGED'
$Active=Join-Path $Bound 'operator-package';$null=Test-NyraManifest $Active
$BindingReport=Get-Content -LiteralPath (Join-Path $Bound 'BINDING-REPORT.json') -Raw|ConvertFrom-Json
Write-Host ('ALIGNMENT_SCOPE_SHA256='+$BindingReport.alignmentScopeSHA256)
Write-Host ('TLS_CARRY_FORWARD_SHA256='+$BindingReport.carryForwardSHA256)
if ($Mode -ceq 'Prepare') {Write-Host 'NEXT_GATE=EXTERNAL_REVIEW_OF_ACTUAL_BOUND_ALIGNMENT_AND_PREPARATION';return}
# Each continuation is tied to exact reviewed helper bytes; conversational consent is insufficient.
$ReviewFile=Join-Path $Bound 'BOUND-REVIEW.json'
Write-NyraJson $ReviewFile @{purpose='accept-exact-generated-source-runtime-preparation-binding';sourceSHA=$Binding.sourceSHA;boundReleaseSHA256=(Get-NyraHash (Join-Path $Bound 'BOUND-RELEASE.json'));bindingReportSHA256=(Get-NyraHash (Join-Path $Bound 'BINDING-REPORT.json'));activeManifestSHA256=(Get-NyraHash (Join-Path $Active 'SHA256SUMS'));alignmentSHA256=$BindingReport.alignmentScopeSHA256;carrySHA256=$BindingReport.carryForwardSHA256;executionAuthorized=$false}
$null=Confirm-NyraScope @{path=$ReviewFile;sha256=(Get-NyraHash $ReviewFile)} 'BOUND_PACKAGE_REVIEW' $WorkDirectory
$Key=Join-Path $env:USERPROFILE '.ssh\nyra-acceptance-20261102-01';$Known=Join-Path $env:USERPROFILE '.ssh\nyra-617219249-known_hosts'
foreach($File in @($Key,$Known)){Assert-Nyra (Test-Path -LiteralPath $File -PathType Leaf) 'PINNED_SSH_INPUT_MISSING'}
$Options=@('-i',$Key,'-o',"UserKnownHostsFile=$Known",'-o','StrictHostKeyChecking=yes','-o','HostKeyAlgorithms=ssh-ed25519','-o','IdentitiesOnly=yes','-o','PasswordAuthentication=no','-o','UpdateHostKeys=no','-o','ClearAllForwardings=yes','-o','ConnectTimeout=15')
if(Test-Path -LiteralPath $StatePath){$State=Get-Content -LiteralPath $StatePath -Raw|ConvertFrom-Json;Assert-Nyra ($State.sourceSHA -ceq $Binding.sourceSHA) 'RESUME_SOURCE_CHANGED'}
else {$State=[pscustomobject]@{sourceSHA=$Binding.sourceSHA;phase='NEW';reviewSHA256='';attempts=[pscustomobject]@{}}}
function Persist($S){Write-NyraJson $StatePath $S}
function Stage-Files([string[]]$Paths){
    $Remote='/root/nyra-live-bootstrap/g08g09-'+[guid]::NewGuid().ToString('N')
    & ssh -T @Options root@142.93.97.141 "umask 077; mkdir -m 700 '$Remote'" |Out-Null
    Assert-Nyra ($LASTEXITCODE -eq 0) 'DIAGNOSTIC_STAGING_STOP'
    & scp @Options @Paths "root@142.93.97.141:$Remote/" |Out-Null
    Assert-Nyra ($LASTEXITCODE -eq 0) 'HELPER_UPLOAD_STOP'
    $Rows=@($Paths|ForEach-Object {"'$(Get-NyraHash $_)' '$([IO.Path]::GetFileName($_))'"}) -join ' '
    & ssh -T @Options root@142.93.97.141 "cd '$Remote' && printf '%s  %s\n' $Rows | sha256sum -c -" |Out-Null
    Assert-Nyra ($LASTEXITCODE -eq 0) 'REMOTE_HELPER_HASH_STOP'
    return $Remote
}
$Resume=Join-Path $WorkDirectory 'native-evidence';$null=New-Item -ItemType Directory -Path $Resume -Force
$OwnerBearer=$null
function Run-Checkpoint([string]$Checkpoint,[string]$Approval='') {
    $Before=@(Get-ChildItem -LiteralPath $Resume -Directory|ForEach-Object {$_.Name})
    $Args=@{Checkpoint=$Checkpoint;ResumeDirectory=$Resume;ApprovedMergeSHA=$Binding.sourceSHA;OwnerBearer=$OwnerBearer}
    if($State.reviewSHA256){$Args.ReviewSHA256=$State.reviewSHA256}
    if($Approval){$Args.ApprovalSHA256=$Approval}
    if($Checkpoint -ceq 'PrepareRenewalRecovery'){$Args.RecoveryScopeSHA256=$Binding.preparationScopeSHA256}
    & (Join-Path $Active 'run-stage3g.ps1') @Args |Out-Host
    $New=@(Get-ChildItem -LiteralPath $Resume -Directory|Where-Object {$Before -notcontains $_.Name})
    Assert-Nyra ($New.Count -eq 1) 'ONE_NEW_NATIVE_EXPORT_REQUIRED'
    $null=Test-NyraManifest $New[0].FullName
    foreach($Name in @('discovery-checkpoint.json','fresh-configuration-scope-preparation.json','PREPARATION-REPORT.json')){
        $Path=Join-Path $New[0].FullName $Name
        if(Test-Path -LiteralPath $Path){return (Get-Content -LiteralPath $Path -Raw|ConvertFrom-Json)}
    }
    throw 'NATIVE_EXPORT_MISSING'
}
function Get-Scope([string]$Kind){
    $Context=Get-Content -LiteralPath (Join-Path $Resume 'discovery-context.json') -Raw|ConvertFrom-Json
    Assert-Nyra ($Context.reviewSHA256 -ceq $State.reviewSHA256) 'LOCAL_REVIEW_BINDING'
    $Hash=$Context.scopeHashes.$Kind;Assert-Nyra ($Hash -cmatch '^[a-f0-9]{64}$') 'LOCAL_SCOPE_HASH'
    $Paths=@(Get-ChildItem -LiteralPath $Resume -File -Recurse|Where-Object {$_.Name -ceq ($Kind+'-'+$Hash+'.json')})
    Assert-Nyra ($Paths.Count -eq 1) 'UNIQUE_LOCAL_SCOPE_REQUIRED'
    return @{path=$Paths[0].FullName;sha256=$Hash}
}
try {
    if($State.phase -ceq 'NEW'){
        $Scope=@{path=(Join-Path $Bound 'ALIGNMENT-SCOPE.json');sha256=$BindingReport.alignmentScopeSHA256}
        $AlignmentApproval=Confirm-NyraScope $Scope 'INACTIVE_ALIGNMENT' $WorkDirectory
        $CarryApproval=Confirm-NyraScope @{path=(Join-Path $Active 'PR36-TLS-CARRY.json');sha256=$BindingReport.carryForwardSHA256} 'TLS_CARRY_FORWARD' $WorkDirectory
        $Aligned=Invoke-NyraOnce $State 'ALIGNMENT' ${function:Persist} {
            $A=Get-Content -LiteralPath $Scope.path -Raw|ConvertFrom-Json
            $Paths=@($Scope.path)+@($A.helpers.PSObject.Properties.Name|ForEach-Object {$Q=Join-Path $Bound $_;if(Test-Path -LiteralPath $Q){$Q}else{Join-Path $Active $_}})
            $Remote=Stage-Files $Paths
            $Lines=& ssh -T @Options root@142.93.97.141 "python3 '$Remote/pr36-inactive-align.py' '$Remote/ALIGNMENT-SCOPE.json' '$AlignmentApproval' '$CarryApproval'" 2>$null
            Assert-Nyra ($LASTEXITCODE -eq 0) 'INACTIVE_ALIGNMENT_STOP_NO_RETRY'
            $R=($Lines -join "`n")|ConvertFrom-Json
            Assert-Nyra ($R.marker -ceq 'NYRA_PR36_INACTIVE_SOURCE_ALIGNMENT_PASS' -and $R.sourceSHA -ceq $Binding.sourceSHA -and $R.stagedFilesVerified -eq 64 -and $R.privateStateUnchanged -eq $true -and $R.configurationInstalled -eq $false -and $R.servicesActivated -eq $false) 'ALIGNMENT_RECEIPT_BINDING'
            Write-NyraJson (Join-Path $WorkDirectory 'inactive-alignment.json') $R
            return $R
        }
        $State.phase='ALIGNED';Persist $State
    }
    Assert-Nyra ($State.phase -in @('ALIGNED','PREPARED')) 'READ_ONLY_RECONCILIATION_REQUIRED'
    if($State.phase -ceq 'ALIGNED'){
        # Inspect existing state first; the native preparer issues at most once and only if expired.
        $Before=Run-Checkpoint 'Inspect'
        $A=$Before.prerequisitesBefore.administration
        Assert-Nyra ($A.expired -eq $true -or [DateTimeOffset]::Parse($A.expiresAt) -gt [DateTimeOffset]::UtcNow.AddMinutes(35)) 'ADMINISTRATION_UNDER_35_MINUTES_NO_UNAPPROVED_REPLACEMENT'
        $PrepApproval=Confirm-NyraScope @{path=(Join-Path $Active 'OWNER-RENEWAL-RECOVERY-SCOPE.json');sha256=$Binding.preparationScopeSHA256} 'PREPARATION' $WorkDirectory
        Write-Host 'Κάνε τώρα Ctrl + R στη σελίδα Owner και πάρε νέο AAL2 bearer.'
        $OwnerBearer=Read-Host 'Owner AAL2 bearer HERE ONLY; hidden, memory only' -AsSecureString
        $Prepared=Invoke-NyraOnce $State 'PREPARATION' ${function:Persist} {Run-Checkpoint 'PrepareRenewalRecovery'}
        Assert-Nyra ($Prepared.marker -ceq 'NYRA_DISCOVERY_INSTALLATION_SCOPE_PREPARED') 'PREPARATION_SCOPE_REQUIRED'
        $State.reviewSHA256=$Prepared.reviewSHA256;$State.phase='PREPARED';Persist $State
    }
    if($null -eq $OwnerBearer){Write-Host 'Κάνε τώρα Ctrl + R στη σελίδα Owner και πάρε νέο AAL2 bearer.';$OwnerBearer=Read-Host 'Owner AAL2 bearer HERE ONLY; hidden, memory only' -AsSecureString}
    $Collectors=@('safe-loader.cjs','discovery-operation.mjs','DISCOVERY-EXECUTION-POLICY.json','tls-checkpoint.mjs','APPROVAL-TLS-ONLY.json','tls-carry-forward.mjs','TLS-CARRY-FORWARD.json','pr36-tls-carry.mjs','PR36-TLS-CARRY.json','verify-phase-evidence.mjs','owner-renewal-diagnostic.mjs','owner-preflight.mjs','dns-wire.mjs')
    $ReadyRemote=Stage-Files @($Collectors|ForEach-Object {Join-Path $Active $_})
    function Readiness {
        $Pointer=[IntPtr]::Zero;$Token=$null;$Payload=$null
        try{
            $Pointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($OwnerBearer);$Token=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($Pointer).Trim() -replace '^Bearer\s+',''
            Assert-Nyra ($Token.Length -gt 30 -and $Token -notmatch '\s') 'FRESH_OWNER_AAL2_BEARER_REQUIRED'
            if(Get-Command Set-Clipboard -ErrorAction SilentlyContinue){Set-Clipboard -Value ' '}
            $Payload=@{token=$Token}|ConvertTo-Json -Compress
            $Command="NYRA_DISCOVERY_ACTION='renewal-readiness' NYRA_READINESS_OWNER_CHECK='1' NYRA_DISCOVERY_REVIEW_SHA256='$($State.reviewSHA256)' /usr/bin/flock --exclusive --nonblock --conflict-exit-code 75 /opt/nyra-5c/private/discovery-operator.lock /usr/local/bin/node '$ReadyRemote/safe-loader.cjs' '$ReadyRemote/discovery-operation.mjs'"
            $Lines=$Payload|& ssh -T @Options root@142.93.97.141 $Command 2>$null
            Assert-Nyra ($LASTEXITCODE -eq 0) 'READINESS_NATIVE_STOP_NO_ACTIVATION'
            $R=($Lines -join "`n")|ConvertFrom-Json
            Assert-Nyra ($R.marker -ceq 'NYRA_G08_PRE_ACTIVATION_READINESS' -and $R.sourceSHA -ceq $Binding.sourceSHA -and $R.reviewSHA256 -ceq $State.reviewSHA256 -and $R.readOnly -eq $true -and $R.credentialsIssued -eq 0 -and $R.protectedOperationsPerformed -eq $false) 'READINESS_BINDING'
            Write-NyraJson (Join-Path $WorkDirectory 'readiness.json') $R;return $R
        }finally{$Payload=$null;$Token=$null;if($Pointer -ne [IntPtr]::Zero){[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($Pointer)}}
    }
    $Adapters=@{
        Readiness=${function:Readiness};Scope=${function:Get-Scope};Persist=${function:Persist};Run=${function:Run-Checkpoint}
        Approve={param($S,$Kind) Confirm-NyraScope $S $Kind $WorkDirectory}
        Warn={Write-Host 'ΠΡΟΣΟΧΗ — ΕΝΕΡΓΟΠΟΙΗΣΗ ΠΡΟΣΤΑΤΕΥΜΕΝΟΥ 15ΛΕΠΤΟΥ'}
        OwnerDispatch={param($R) Assert-Nyra ($R.ownerActionURL -ceq 'https://github.com/Noctua76/eliaskalyvas-website/actions/workflows/nyra-live-trust-acceptance.yml') 'DISPATCH_URL_BINDING';Write-Host $R.ownerActionURL;Write-Host 'Owner Noctua76: select main, Run workflow ONCE. Approve required GitHub environments if prompted. Do not dispatch again.';Read-Host 'Enter after the single GitHub UI dispatch; verification continues automatically'|Out-Null}
        Verify={param($Reserved)
            do{
                Assert-Nyra ([DateTimeOffset]::UtcNow -lt [DateTimeOffset]::Parse($Reserved.stopDeadline)) 'G09_FIXED_WINDOW_ENDED'
                $R=Run-Checkpoint 'VerifyDiscovery'
                if($R.marker -ceq 'NYRA_DISCOVERY_SIGNED_EVIDENCE_VERIFIED'){return $R}
                Assert-Nyra ($R.marker -ceq 'NYRA_DISCOVERY_EVIDENCE_INCOMPLETE') 'G09_VERIFICATION_STOP'
                # Polling is read-only; no dispatch, renewal or authorization is retried.
                Start-Sleep -Seconds 5
            }while($true)
        }
    }
    $Result=Invoke-NyraProtectedSequence $State $Binding $Adapters
    Write-NyraJson (Join-Path $WorkDirectory 'G08-G09-ACCEPTANCE.json') $Result
    $Sums=@(Get-ChildItem -LiteralPath $WorkDirectory -File -Recurse|Where-Object {$_.Name -ne 'EXPORT-SHA256SUMS'}|Sort-Object FullName|ForEach-Object {(Get-NyraHash $_.FullName)+'  '+$_.FullName.Substring($WorkDirectory.Length+1).Replace('\','/')})
    [IO.File]::WriteAllLines((Join-Path $WorkDirectory 'EXPORT-SHA256SUMS'),[string[]]$Sums,(New-Object Text.UTF8Encoding($false)))
    Write-Host 'NYRA_G08_G09_NATIVE_PASS; G10_INDEPENDENT_ACCEPTANCE_REQUIRED'
}catch{
    Write-NyraJson (Join-Path $WorkDirectory 'orchestrator-stop.json') @{marker='NYRA_ORCHESTRATOR_STOP';code=if($_.Exception.Message -cmatch '^[A-Z0-9_]{2,120}$'){$_.Exception.Message}else{'UNVERIFIED_FAILURE'};noAutomaticRetry=$true;protectedOutcome='VERIFY_RECORDED_NATIVE_EVIDENCE';phase=$State.phase}
    throw 'NYRA_ORCHESTRATOR_STOP_SEE_SANITIZED_EVIDENCE_NO_RETRY'
}finally{if($null -ne $OwnerBearer){$OwnerBearer.Dispose();$OwnerBearer=$null}}
