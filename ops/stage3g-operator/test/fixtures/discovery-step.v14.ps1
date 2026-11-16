# Fixed-schema STOP reports. Unverified stdout/stderr is never persisted.
function New-NyraUnverifiedFailure([int]$ExitCode,[string]$Action) {
    $Code='UNVERIFIED_REMOTE_FAILURE'; $Category='UNCLASSIFIED'
    if ($ExitCode -eq 75) { $Code='OPERATION_LOCK_BUSY'; $Category='LOCKING' }
    elseif ($ExitCode -eq 255) { $Code='SSH_TRANSPORT_FAILED'; $Category='TRANSPORT' }
    return [ordered]@{schema='nyra.stage3g.discovery-failure.v1';marker='NYRA_DISCOVERY_OPERATION_CLOSED';action=$Action;stage='TRANSPORT';code=$Code;category=$Category;phase='UNOBSERVED';nativeRenewalInvoked=$null;overall='INCOMPLETE';noAutomaticRetry=$true;renewalFailure=$null;remoteReportVerified=$false}
}
function ConvertTo-NyraFailureReport([string]$RawClosed,[string]$ExpectedAction) {
    if (!$RawClosed -or $RawClosed.Length -gt 65536) { throw 'INVALID_DISCOVERY_FAILURE_REPORT' }
    $Closed=$RawClosed | ConvertFrom-Json -ErrorAction Stop
    $Fields=@('action','category','code','marker','nativeRenewalInvoked','noAutomaticRetry','overall','phase','renewalFailure','schema','stage')
    if ($Closed -isnot [System.Management.Automation.PSCustomObject] -or (@($Closed.PSObject.Properties.Name | Sort-Object) -join ',') -cne ($Fields -join ',')) { throw 'INVALID_DISCOVERY_FAILURE_REPORT' }
    $RawNative=[regex]::Matches($RawClosed,'"renewalFailure"\s*:\s*\{(?<fields>[^{}]*)\}')
    $Top=$RawClosed
    if ($null -ne $Closed.renewalFailure) {
        if ($RawNative.Count -ne 1) { throw 'INVALID_DISCOVERY_FAILURE_REPORT' }
        $RawKeys=[regex]::Matches($RawNative[0].Groups['fields'].Value,'"(?:[^"\\]|\\.)*"\s*:')
        if ($RawKeys.Count -ne 4 -or @($RawKeys | Where-Object {$_.Value -cnotmatch '^"(marker|stage|code|noAutomaticRetry)"\s*:$'}).Count -ne 0) { throw 'INVALID_DISCOVERY_FAILURE_REPORT' }
        $Top=$Top.Remove($RawNative[0].Index,$RawNative[0].Length)
    } elseif ($RawNative.Count -ne 0) { throw 'INVALID_DISCOVERY_FAILURE_REPORT' }
    $TopKeys=@([regex]::Matches($Top,'"(?:[^"\\]|\\.)*"\s*:'))
    # The removed nested property accounts for one top key when non-null.
    if ($null -ne $Closed.renewalFailure) { $TopKeys=@($TopKeys)+@([pscustomobject]@{Value='"renewalFailure":'}) }
    if ($TopKeys.Count -ne $Fields.Count) { throw 'INVALID_DISCOVERY_FAILURE_REPORT' }
    $LiteralNames=@($TopKeys | ForEach-Object { if ($_.Value -cmatch '^"([A-Za-z]+)"\s*:$') {$Matches[1]} else {throw 'INVALID_DISCOVERY_FAILURE_REPORT'} })
    if ((@($LiteralNames | Sort-Object -Unique) -join ',') -cne ($Fields -join ',')) { throw 'INVALID_DISCOVERY_FAILURE_REPORT' }
    $Stages=@('ENTRY','HOST_PREFLIGHT','DRAFT_CONTEXT','OPERATION_STATE','SESSION_WINDOW','INSTALLATION_APPROVAL','INSTALLATION_PREREQUISITES','INSTALLATION_BACKEND','INSTALLATION_WINDOW','OWNER_AUTHORIZATION','RENEWAL_APPROVAL','OWNER_DECISION','PROTECTED_TIMER','RENEWAL_ISOLATION','REPOSITORY_TRUST','RENEWAL_JOURNAL','RENEWAL_AUTHENTICATION','RENEWAL_PREFLIGHT','NATIVE_RENEWAL','RENEWAL_VERIFICATION','STATUS','READINESS')
    $Codes=@('ACCEPTANCE_HTTPS_NOT_READY','ACCEPTED_TLS_RECEIPT_PIN','ACTIVATION_ALREADY_ATTEMPTED_NO_REPLAY','ACTIVATION_ISOLATION','ADMINISTRATION_MARGIN_UNDER_35_MINUTES','ADMINISTRATION_REFRESH_REQUIRED','ADMINISTRATION_SCOPE','CADDY_PINS','CAPTURE_AUTHORITY_BINDING','CAPTURE_PATH','CONCRETE_SCOPE_NOT_PREPARED','CURRENT_ADMINISTRATION_CHANGED','DIRECTORY_SECURITY','DISCOVERY_OPERATION_FAILED','DISCOVERY_POLICY_PIN','DISPATCH_ALREADY_RESERVED_NO_RETRY','DISPATCH_BASELINE_READ','DISPATCH_RESERVATION_RUN_BINDING','DRAFT_CONTEXT','DRAFT_FILE_SET','DRAFT_HASH','DRAFT_TRUST_PIN','EACCES','ECONNREFUSED','ENOENT','EXACT_DRAFT_REQUIRED','EXACT_OWNER_RUN_ID','EXACT_REVIEW_SHA_REQUIRED','EXACT_SEPARATE_OWNER_APPROVAL_REQUIRED','EXACT_TARGET','EXECUTION_POLICY_PIN','EXECUTION_TIMEOUT','EXISTING_OPERATION_MUST_RESUME','EXISTING_OWNER_MFA_UNVERIFIED','FILESYSTEM_ACCESS_FAILED','FILE_SECURITY','FIXED_HOST_TIMER','FRESH_BOUNDED_SESSION_REQUIRED','FRESH_DRAFT_REQUIRED','FRESH_G07_SESSION_REQUIRED','FRESH_OWNER_AAL2_REQUIRED','FRESH_OWNER_TOKEN_REQUIRED','FRESH_SIGNED_OWNER_DECISION','GITHUB_RESERVED_RUN_READ','INSTALLATION_ALREADY_ATTEMPTED_NO_REPLAY','INSTALLATION_ISOLATION','INSTALLED_CONFIGURATION_CHANGED','LEASE_STATE_CHANGED','MACHINE_BINDING','MATCHING_RENEWAL_EVIDENCE','NATIVE_RENEWAL_FAILED','NATIVE_RENEWAL_NOT_COMMITTED','NATIVE_RUNTIME_RETIREMENT_UNCONFIRMED','NEW_INDEPENDENTLY_APPROVED_SESSION_REQUIRED','OPERATION_STATE_BINDING','OPERATION_TIMER_ALREADY_CREATED','ORIGINAL_CONFIGURATION_CHANGED','ORIGINAL_PROTECTED_STOP_TIMER','OWNER_AAL2_REQUIRED','OWNER_AUTHENTICATED_SESSION_MISMATCH','OWNER_AUTH_CONFIG_PIN','OWNER_BACKEND_PIN','OWNER_BINDING_INVALID_OR_EXPIRED','OWNER_BINDING_MISMATCH','OWNER_CHANNEL_ABSENT','OWNER_CHANNEL_ACCESS_DENIED','OWNER_CHANNEL_BINDING','OWNER_CHANNEL_NOT_PROBED','OWNER_CHANNEL_PERMISSIONS','OWNER_CHANNEL_REFUSED','OWNER_CHANNEL_TIMEOUT','OWNER_CHANNEL_UNAVAILABLE','OWNER_CLAIMS_INVALID','OWNER_DECISION_CONTEXT_MISMATCH','OWNER_DECISION_INACTIVE_OR_CHANGED','OWNER_DECISION_MARGIN_UNDER_600_SECONDS','OWNER_DECISION_MISSING','OWNER_DECISION_OR_WINDOW_EXPIRED','OWNER_DECISION_SIGNATURE_OR_CHAIN','OWNER_DISPATCH_RESERVATION_REQUIRED','OWNER_HTTP_DENIED','OWNER_IDENTITY_MISMATCH','OWNER_MFA_UNVERIFIED','OWNER_RECOVERY_CONTEXT','OWNER_RECOVERY_GATE','OWNER_RENEWAL_ATTEMPT_ALREADY_RESERVED_NO_RETRY','OWNER_RENEWAL_PREFLIGHT_DENIED','OWNER_REQUEST_DENIED','OWNER_RESPONSE_INVALID','OWNER_RESPONSE_TOO_LARGE','OWNER_SESSION_BINDING_INVALID','OWNER_SESSION_NOT_COMPARABLE','OWNER_SOURCE_SOCKET_NOT_READY','OWNER_SOURCE_START_FAILED','OWNER_STATUS_GATE_DENIED','OWNER_STATUS_HTTP_DENIED','OWNER_STATUS_INVALID_RESPONSE','OWNER_STATUS_UNAVAILABLE','OWNER_TOKEN_MARGIN_NOT_OVER_600_SECONDS','OWNER_TOKEN_MARGIN_UNDER_1800_SECONDS','OWNER_USER_HTTP_DENIED','OWNER_USER_INVALID_RESPONSE','OWNER_USER_UNAVAILABLE','POSTGRES_NETWORK_ISOLATION','POSTGRES_PUBLIC_PORT','POSTGRES_READ_ONLY_PREREQUISITES','POSTGRES_RESOURCE_BINDING','PRESERVED_CONFIGURATION','PRIVATE_PATH_AND_ALLOWLIST_PINS','PRIVATE_ROLE_CREDENTIAL_SCOPE','PROTECTED_WINDOW_TOO_SHORT','READ_ONLY_JOURNAL','RENEWAL_ISOLATION','RENEWAL_LOCK_BUSY','RENEWAL_LOCK_SECURITY','REPOSITORY_TRUST_ADMINISTRATION_CHANGED','REPOSITORY_TRUST_ADMINISTRATION_STALE','REPOSITORY_TRUST_OWNER_AUTHORIZATION','REPOSITORY_TRUST_OWNER_BINDING','REPOSITORY_TRUST_OWNER_FRESHNESS','REPOSITORY_TRUST_OWNER_SOURCE_UNVERIFIED','REPOSITORY_TRUST_RETIREMENT_UNCONFIRMED','REVIEWED_NATIVE_COMMIT_GUARD_REQUIRED','ROLE_IDENTITY','ROOT_REQUIRED','RUNTIME_BYTES','RUNTIME_INGRESS_NOT_READY','RUNTIME_MANIFEST','RUNTIME_MUST_RETIRE_AND_EXIT','RUNTIME_NOT_READY','RUNTIME_PATH','RUNTIME_START_FAILED','RUN_PREDATES_DISPATCH_APPROVAL','SCOPED_SERVICES_NOT_STOPPED','SCOPE_BINDING','SCOPE_BYTES_CHANGED','SCOPE_FILE_CHANGED','SECRET_INPUT_LIMIT','SERVICES_MUST_REMAIN_INACTIVE','SERVICE_UNIT_PIN','SESSION_BINDING','SESSION_DURATION_POLICY','SIGNER_PINS','SINGLE_OWNER','SOURCE_PINS','STOP_TIMER_COMMAND_PIN','UNCLASSIFIED','UNKNOWN_DISCOVERY_ACTION','UNOWNED_RUNTIME_ACTIVATION')
    if ($Closed.schema -cne 'nyra.stage3g.discovery-failure.v1' -or $Closed.marker -cne 'NYRA_DISCOVERY_OPERATION_CLOSED' -or $Closed.action -cne $ExpectedAction -or $Closed.stage -isnot [string] -or $Stages -cnotcontains $Closed.stage -or $Closed.code -isnot [string] -or $Codes -cnotcontains $Closed.code -or $Closed.category -cnotin @('TIMING','LOCKING','AUTHENTICATION','BINDING','AUTHORIZATION','STATE','BOUNDARY','UNCLASSIFIED','COMMUNICATION','DATABASE') -or $Closed.phase -cnotin @('UNOBSERVED','PREPARED','INSTALLING','OWNER_AUTHORIZED','RENEWAL_REQUESTED','LEASE_READY','ACTIVATING','RUNTIME_READY','DISPATCH_RESERVED','CLOSED') -or $Closed.nativeRenewalInvoked -isnot [bool] -or $Closed.overall -cne 'INCOMPLETE' -or $Closed.noAutomaticRetry -isnot [bool] -or $Closed.noAutomaticRetry -ne $true) { throw 'INVALID_DISCOVERY_FAILURE_REPORT' }
    foreach ($Field in @('schema','marker','action','stage','code','category','phase','overall')) { if ($Closed.$Field -isnot [string]) { throw 'INVALID_DISCOVERY_FAILURE_REPORT' } }
    $NativeFailure=$Closed.renewalFailure
    if ($Closed.code -ceq 'NATIVE_RENEWAL_FAILED' -and ($null -eq $NativeFailure -or $Closed.nativeRenewalInvoked -ne $true)) {throw 'INVALID_DISCOVERY_FAILURE_REPORT'}
    if ($null -ne $NativeFailure) {
        $AllowedStages=@('ENTRY','LOCK_OPEN','LOCK_CHECK','LOCK_OR_CHILD','PRIVATE_INPUTS',
                        'OWNER_KEY','MACHINE_BINDING','OWNER_CONFIGURATION','OWNER_TOKEN_INPUT','OWNER_RENEWAL_REQUEST',
                        'OWNER_APPROVAL_VERIFY','TRUST_GATE_SETUP','HOST_BOUNDARY','JOURNAL_HISTORY','RESOURCE_BOUNDARY',
                        'PRE_JOURNAL_TRUST','ROLE_IDENTITIES','ROLE_DIRECTORIES','JOURNAL_RESERVATION','CREDENTIAL_STAGING',
                        'PRECOMMIT_TRUST','PRECOMMIT_BOUNDARY','DATABASE_ROTATION','CREDENTIAL_INSTALLATION','CREDENTIAL_VERIFICATION',
                        'RENEWAL_COMPLETION','NATIVE_PROCESS')
        $AllowedCodes=@('NYRA_DB_RENEWAL_DISABLED','NYRA_DB_RENEWAL_ROOT','NYRA_DB_RENEWAL_TARGET_PIN','NYRA_DB_RENEWAL_OWNER_KEY_ID','NYRA_DB_RENEWAL_MACHINE_ID',
                        'NYRA_DB_RENEWAL_SEALED_FILE','NYRA_DB_RENEWAL_TOKEN_SIZE','NYRA_DB_RENEWAL_OWNER_AAL2_TOKEN','NYRA_DB_RENEWAL_TRUST_ADAPTER','NYRA_DB_RENEWAL_HOST',
                        'NYRA_DB_RENEWAL_ISOLATION','NYRA_DB_RENEWAL_JOURNAL_PATH','NYRA_DB_RENEWAL_STATE','NYRA_DB_RENEWAL_REPLAY','NYRA_DB_RENEWAL_RESOURCE_LABEL',
                        'NYRA_DB_RENEWAL_PUBLIC_PORT','NYRA_DB_RENEWAL_PG17','NYRA_DB_RENEWAL_SCRAM_RULES','NYRA_DB_RENEWAL_OWNER_ADMINISTRATION','NYRA_DB_RENEWAL_ROLE_USER',
                        'NYRA_DB_RENEWAL_ROLE_PARENT','NYRA_DB_RENEWAL_ROLE_DIRECTORY','NYRA_DB_RENEWAL_STAGED_FILE','NYRA_DB_RENEWAL_ROLE_SCOPE','NYRA_DB_RENEWAL_TRUST_RECHECK',
                        'NYRA_DB_RENEWAL_PRECOMMIT_BOUNDARY','NYRA_DB_RENEWAL_COMMAND_DENIED','NYRA_DB_RENEWAL_SERVER_VALIDITY','NYRA_DB_RENEWAL_CREDENTIAL_READBACK','NYRA_DB_RENEWAL_NEW_PASSWORD_REJECTED',
                        'NYRA_DB_RENEWAL_OLD_PASSWORD_SURVIVED','NYRA_DB_RENEWAL_CROSS_ROLE_CREDENTIAL','NYRA_DB_RENEWAL_GITHUB_CREDENTIAL','NYRA_DB_RENEWAL_LOCK','DB_RENEWAL_APPROVAL_FIELDS',
                        'DB_RENEWAL_APPROVAL_IDENTITY','DB_RENEWAL_APPROVAL_WINDOW','DB_RENEWAL_APPROVAL_KEY_PIN','DB_RENEWAL_APPROVAL_BINDING','DB_RENEWAL_APPROVAL_FRESHNESS',
                        'REPOSITORY_TRUST_SOURCE_REQUIRED','REPOSITORY_TRUST_POLICY_BINDING','REPOSITORY_TRUST_RETIRED','REPOSITORY_TRUST_OPERATION','REPOSITORY_TRUST_ADMINISTRATION_CHANGED',
                        'REPOSITORY_TRUST_OWNER_SOURCE_UNVERIFIED','REPOSITORY_TRUST_OWNER_BINDING','REPOSITORY_TRUST_OWNER_AUTHORIZATION','REPOSITORY_TRUST_OWNER_FRESHNESS','REPOSITORY_TRUST_ADMINISTRATION_STALE',
                        'REPOSITORY_TRUST_RETIREMENT_UNCONFIRMED','PRIVATE_FILE','OWNER_REQUEST_DENIED','ADMIN_CREDENTIAL_REQUIRED','ADMIN_READ_SCOPE',
                        'ADMIN_READ_DENIED','ADMIN_READ_INCOMPLETE','ADMIN_READ_SIZE','ADMIN_READ_UNAVAILABLE','ADMIN_READ_STALE',
                        'ADMIN_SNAPSHOT_CHANGED','DB_RENEWAL_FIELDS','DB_RENEWAL_IDENTITY','DB_RENEWAL_WINDOW','UNCLASSIFIED',
                        'FILESYSTEM_ACCESS_FAILED','NYRA_DB_RENEWAL_OWNER_DECISION_MARGIN','NYRA_DB_RENEWAL_OWNER_DECISION_BINDING','NYRA_DB_RENEWAL_OWNER_JOURNAL_VERIFICATION','OWNER_CHANNEL_ABSENT','OWNER_CHANNEL_REFUSED','OWNER_CHANNEL_ACCESS_DENIED','OWNER_CHANNEL_UNAVAILABLE','OWNER_CHANNEL_TIMEOUT','OWNER_HTTP_DENIED','OWNER_RESPONSE_TOO_LARGE','OWNER_RESPONSE_INVALID')
        if ($Closed.code -cne 'NATIVE_RENEWAL_FAILED' -or $Closed.nativeRenewalInvoked -ne $true -or $NativeFailure -isnot [System.Management.Automation.PSCustomObject] -or (@($NativeFailure.PSObject.Properties.Name | Sort-Object) -join ',') -cne 'code,marker,noAutomaticRetry,stage' -or $NativeFailure.marker -cne 'NYRA_DB_RENEWAL_DENIED' -or $NativeFailure.stage -isnot [string] -or $AllowedStages -cnotcontains $NativeFailure.stage -or $NativeFailure.code -isnot [string] -or $AllowedCodes -cnotcontains $NativeFailure.code -or $NativeFailure.noAutomaticRetry -isnot [bool] -or $NativeFailure.noAutomaticRetry -ne $true) { throw 'INVALID_DISCOVERY_FAILURE_REPORT' }
        $NativeFailure=[ordered]@{marker='NYRA_DB_RENEWAL_DENIED';stage=$NativeFailure.stage;code=$NativeFailure.code;noAutomaticRetry=$true}
    }
    $Cause=$Closed.code
    if ($null -ne $NativeFailure) {$Cause=$NativeFailure.code}
    $Category='BOUNDARY'
    if ($Cause -cmatch '^OWNER_CHANNEL|^OWNER_RESPONSE') {$Category='COMMUNICATION'}
    elseif ($Cause -ceq 'NEW_INDEPENDENTLY_APPROVED_SESSION_REQUIRED') {$Category='STATE'}
    elseif ($Cause -cmatch '^NYRA_DB_RENEWAL_(COMMAND_DENIED|SERVER_VALIDITY|CREDENTIAL_|NEW_PASSWORD|OLD_PASSWORD|CROSS_ROLE|PG17|SCRAM)') {$Category='DATABASE'}
    elseif ($Cause -cmatch 'TIME|WINDOW|FRESH|MARGIN|EXPIR') {$Category='TIMING'}
    elseif ($Cause -cmatch 'LOCK') {$Category='LOCKING'}
    elseif ($Cause -cmatch 'AUTHENTICATION|AAL2|MFA|TOKEN|OWNER_USER|OWNER_STATUS_HTTP|OWNER_CLAIMS') {$Category='AUTHENTICATION'}
    elseif ($Cause -cmatch 'SESSION|BINDING|POLICY|CONFIGURATION|SOURCE|PIN|CONTEXT') {$Category='BINDING'}
    elseif ($Cause -cmatch 'DECISION|APPROVAL|AUTHORIZATION|REQUEST_DENIED|CHANNEL|REPOSITORY_TRUST') {$Category='AUTHORIZATION'}
    elseif ($Cause -cmatch 'LEASE|JOURNAL|REPLAY|RESERVED|STATE|ALREADY') {$Category='STATE'}
    if ($Cause -ceq 'DISCOVERY_OPERATION_FAILED') {$Category='UNCLASSIFIED'}
    if ($Closed.category -cne $Category) {throw 'INVALID_DISCOVERY_FAILURE_REPORT'}
    return [ordered]@{schema='nyra.stage3g.discovery-failure.v1';marker='NYRA_DISCOVERY_OPERATION_CLOSED';action=$Closed.action;stage=$Closed.stage;code=$Closed.code;category=$Closed.category;phase=$Closed.phase;nativeRenewalInvoked=$Closed.nativeRenewalInvoked;overall='INCOMPLETE';noAutomaticRetry=$true;renewalFailure=$NativeFailure;remoteReportVerified=$true}
}
function Save-NyraFailureEvidence($Failure) {
    $File=Join-Path $Pass 'discovery-failure.json'
    Save-NyraJson $File $Failure
    $Rows=@((Get-FileHash -LiteralPath $File -Algorithm SHA256).Hash.ToLowerInvariant()+'  discovery-failure.json')
    [IO.File]::WriteAllLines((Join-Path $Pass 'FAILURE-SHA256SUMS'),[string[]]$Rows,(New-Object Text.UTF8Encoding($false)))
    Write-Host ('FAILURE_EVIDENCE_FILE='+$File)
    Write-Host ($Failure | ConvertTo-Json -Depth 10)
}

# Internal step implementation; run-stage3g.ps1 is the only user entry point.
if ($Checkpoint -in @('InstallDiscoveryOwner','RenewDiscovery','OwnerPreflight','OwnerRenewalPreflight')) {
    $Secret = Read-Host 'Fresh Owner AAL2 bearer HERE ONLY (hidden); never paste in ChatGPT' -AsSecureString
    $Pointer = [IntPtr]::Zero
    try {
        $Pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secret)
        $Bearer = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($Pointer).Trim() -replace '^Bearer\s+', ''
        if ($Bearer.Length -lt 30 -or $Bearer -match '\s') { throw 'FRESH_OWNER_AAL2_BEARER_REQUIRED' }
        $Payload = @{token=$Bearer} | ConvertTo-Json -Compress
        if (Get-Command Set-Clipboard -ErrorAction SilentlyContinue) { Set-Clipboard -Value ' ' }
        $Action = $DiscoveryActions[$Checkpoint]
        $TargetModule = 'discovery-operation.mjs'
        $NodeLock = '/usr/bin/flock --exclusive --nonblock --conflict-exit-code 75 /opt/nyra-5c/private/discovery-operator.lock '
        if ($Checkpoint -eq 'OwnerPreflight') { $TargetModule = 'owner-preflight.mjs'; $NodeLock = '' }
        $Command = "NYRA_REVIEWED_SOURCE_SHA='$Source' NYRA_DISCOVERY_ACTION='$Action' NYRA_DISCOVERY_REVIEW_SHA256='$ReviewSHA256' NYRA_DISCOVERY_APPROVAL_SHA256='$ApprovalSHA256' ${NodeLock}/usr/local/bin/node '$Remote/safe-loader.cjs' '$Remote/$TargetModule'"
        $NativeExit=255; $Lines=@()
        try { $Lines = $Payload | & ssh -T @Options root@142.93.97.141 $Command 2>$null; $NativeExit=$LASTEXITCODE }
        catch { if ($LASTEXITCODE -is [int] -and $LASTEXITCODE -ne 0) {$NativeExit=$LASTEXITCODE} else {$NativeExit=255} }
        if ($NativeExit -ne 0) {
            try { $Failure=ConvertTo-NyraFailureReport ($Lines -join "`n") $Action }
            catch { $Failure=New-NyraUnverifiedFailure $NativeExit $Action }
            Save-NyraFailureEvidence $Failure
            throw 'DISCOVERY_PROTECTED_OPERATION_CLOSED_RETURN_SANITIZED_OUTPUT_ONLY'
        }
        $Result = ($Lines -join "`n") | ConvertFrom-Json
    } finally {
        $Payload = $null; $Bearer = $null
        if ($Pointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($Pointer) }
        if ($null -ne $Secret) { $Secret.Dispose() }
    }
} else { $Result = Invoke-NyraModule 'discovery-operation.mjs' }
if ($Result.resourceId -ne '617219249' -or $Result.sourceSHA -cne $Source) { throw 'DISCOVERY_RECEIPT_BINDING' }
Save-NyraJson (Join-Path $Pass 'discovery-checkpoint.json') $Result
if ($Result.reviewSHA256) {
    if ($Result.reviewSHA256 -cnotmatch '^[a-f0-9]{64}$' -or $Result.operationDirectory -cne ('/opt/nyra-5c/private/fresh-trust/discovery-operation-' + $Result.reviewSHA256)) { throw 'DISCOVERY_OPERATION_DIRECTORY_BINDING' }
    if ($null -eq $DiscoveryContext) { $DiscoveryContext = [pscustomobject]@{reviewSHA256=$Result.reviewSHA256;scopeHashes=[pscustomobject]@{}} }
    if ($DiscoveryContext.reviewSHA256 -cne $Result.reviewSHA256) {
        if ($Checkpoint -ne 'PrepareDiscovery' -or $DiscoveryContext.reviewSHA256 -cnotmatch '^[a-f0-9]{64}$') { throw 'RESUME_REVIEW_CHANGED_STOP' }
        Save-NyraJson (Join-Path $Output ('discovery-context-' + $DiscoveryContext.reviewSHA256 + '.json')) $DiscoveryContext
        $DiscoveryContext = [pscustomobject]@{reviewSHA256=$Result.reviewSHA256;scopeHashes=[pscustomobject]@{}}
    }
    if ($null -ne $Result.nextScope) {
        $Scope = $Result.nextScope
        if ($Scope.path -cnotmatch '^/opt/nyra-5c/private/fresh-trust/discovery-operation-[a-f0-9]{64}/(installation|renewal|activation|dispatch)-[a-f0-9]{64}\.json$' -or $Scope.sha256 -cnotmatch '^[a-f0-9]{64}$') { throw 'CONCRETE_SCOPE_PATH' }
        $ScopeOutput = Join-Path $Pass ([IO.Path]::GetFileName([string]$Scope.path))
        & scp @Options "root@142.93.97.141:$($Scope.path)" $ScopeOutput
        if ($LASTEXITCODE -ne 0 -or (Get-FileHash -LiteralPath $ScopeOutput -Algorithm SHA256).Hash.ToLowerInvariant() -cne $Scope.sha256) { throw 'CONCRETE_SCOPE_EXPORT_HASH' }
        $Concrete = Get-Content -LiteralPath $ScopeOutput -Raw | ConvertFrom-Json
        if ($Concrete.reviewSHA256 -cne $Result.reviewSHA256 -or $Concrete.approved -ne $false) { throw 'CONCRETE_SCOPE_CONTENT' }
        $DiscoveryContext.scopeHashes | Add-Member -NotePropertyName $Concrete.kind -NotePropertyValue $Scope.sha256 -Force
        Write-Host "NEXT_SCOPE_KIND=$($Concrete.kind)"
        Write-Host "NEXT_SCOPE_SHA256=$($Scope.sha256)"
        Write-Host "NEXT_SCOPE_FILE=$ScopeOutput"
    }
    if ($Result.cleanupScopeKind -in @('installation','activation')) { $DiscoveryContext | Add-Member -NotePropertyName cleanupScopeKind -NotePropertyValue $Result.cleanupScopeKind -Force }
    Save-NyraJson $DiscoveryContextPath $DiscoveryContext
}
if ($Checkpoint -eq 'ReserveDiscoveryDispatch') {
    if ($Result.ownerActionURL -cne 'https://github.com/Noctua76/eliaskalyvas-website/actions/workflows/nyra-live-trust-acceptance.yml' -or $Result.dispatchPerformed -ne $false) { throw 'OWNER_DISPATCH_HANDOFF_BINDING' }
    Write-Host 'OWNER_ACTION: open the following workflow as Noctua76, select main, click Run workflow exactly once. No automatic dispatch occurs.'
    Write-Host $Result.ownerActionURL
}
$Text = [IO.File]::ReadAllText((Join-Path $Pass 'discovery-checkpoint.json'))
if ($Text -match '-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|sb_secret_|eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.') { throw 'SECRET_IN_DISCOVERY_EXPORT' }
$Sums = @(Get-ChildItem -LiteralPath $Pass -File -Recurse | Where-Object {$_.Name -ne 'SHA256SUMS'} | Sort-Object FullName | ForEach-Object {(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant() + '  ' + $_.FullName.Substring($Pass.Length + 1).Replace('\','/')})
[IO.File]::WriteAllLines((Join-Path $Pass 'SHA256SUMS'),$Sums,(New-Object Text.UTF8Encoding($false)))
foreach ($Line in $Sums) { if ((Get-FileHash -LiteralPath (Join-Path $Pass $Line.Substring(66)) -Algorithm SHA256).Hash.ToLowerInvariant() -cne $Line.Substring(0,64)) { throw 'DISCOVERY_EXPORT_HASH' } }
$Zip = $Pass + '.zip'
Compress-Archive -LiteralPath $Pass -DestinationPath $Zip -CompressionLevel Optimal
Write-Host "MARKER=$($Result.marker)"
Write-Host 'STAGE3G=INCOMPLETE; NEXT_PROTECTED_SCOPE_REQUIRES_SEPARATE_APPROVAL'
Write-Host "RESUME_DIRECTORY=$Output"
Write-Host "EVIDENCE_ZIP=$Zip"
Write-Host ('EVIDENCE_ZIP_SHA256=' + (Get-FileHash -LiteralPath $Zip -Algorithm SHA256).Hash.ToLowerInvariant())
