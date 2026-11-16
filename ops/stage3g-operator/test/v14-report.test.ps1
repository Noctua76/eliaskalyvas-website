param([Parameter(Mandatory=$true)][string]$StepPath,[Parameter(Mandatory=$true)][string]$OutputDirectory)
$ErrorActionPreference='Stop'
$null=New-Item -ItemType Directory -Path $OutputDirectory -Force
$Canary='SYNTHETIC_TOKEN_NEVER_EXPORT_12345678901234567890'
function global:Read-Host { ConvertTo-SecureString $Canary -AsPlainText -Force }
function global:Set-Clipboard { param($Value) if ($Value -cne ' ') { throw 'CLIPBOARD_REGRESSION' } }
function global:ssh { $null=@($input);$global:LASTEXITCODE=$script:FakeExit;if ($script:Frame) {Write-Output $script:Frame} }
function Save-NyraJson([string]$Path,$Value) { [IO.File]::WriteAllText($Path,($Value|ConvertTo-Json -Depth 30),(New-Object Text.UTF8Encoding($false))) }
$Base=[ordered]@{schema='nyra.stage3g.discovery-failure.v1';marker='NYRA_DISCOVERY_OPERATION_CLOSED';action='renew';stage='OWNER_DECISION';code='OWNER_DECISION_MARGIN_UNDER_600_SECONDS';category='TIMING';phase='OWNER_AUTHORIZED';nativeRenewalInvoked=$false;overall='INCOMPLETE';noAutomaticRetry=$true;renewalFailure=$null}
$Cases=@('wrong-category','missing-native','array-action','timing','authentication','authorization','binding','native-database','native-clock','unknown-code','unknown-field','unknown-stage','missing-field','string-bool','string-no-retry','duplicate-key','case-duplicate-key','escaped-key','malformed-json','oversized','nested-secret','nested-extra','empty','lock','ssh')
$Results=@()
foreach($Case in $Cases) {
    $Pass=Join-Path $OutputDirectory $Case;$null=New-Item -ItemType Directory -Path $Pass -Force
    $F=$Base|ConvertTo-Json -Depth 20|ConvertFrom-Json
    $ExpectedVerified=$true;$ExpectedCategory='TIMING';$script:FakeExit=1
    switch($Case) {
        'wrong-category' {$F.category='AUTHENTICATION';$ExpectedVerified=$false}
        'missing-native' {$F.code='NATIVE_RENEWAL_FAILED';$F.nativeRenewalInvoked=$true;$ExpectedVerified=$false}
        'array-action' {$F.action=@('renew');$ExpectedVerified=$false}
        'authentication' {$F.code='OWNER_MFA_UNVERIFIED';$F.category='AUTHENTICATION';$ExpectedCategory='AUTHENTICATION'}
        'authorization' {$F.code='OWNER_REQUEST_DENIED';$F.category='AUTHORIZATION';$ExpectedCategory='AUTHORIZATION'}
        'binding' {$F.code='OWNER_AUTHENTICATED_SESSION_MISMATCH';$F.category='BINDING';$ExpectedCategory='BINDING'}
        'native-database' {$F.code='NATIVE_RENEWAL_FAILED';$F.category='DATABASE';$F.stage='NATIVE_RENEWAL';$F.nativeRenewalInvoked=$true;$F.renewalFailure=[pscustomobject]@{marker='NYRA_DB_RENEWAL_DENIED';stage='DATABASE_ROTATION';code='NYRA_DB_RENEWAL_COMMAND_DENIED';noAutomaticRetry=$true};$ExpectedCategory='DATABASE'}
        'native-clock' {$F.code='NATIVE_RENEWAL_FAILED';$F.category='TIMING';$F.stage='NATIVE_RENEWAL';$F.nativeRenewalInvoked=$true;$F.renewalFailure=[pscustomobject]@{marker='NYRA_DB_RENEWAL_DENIED';stage='DATABASE_ROTATION';code='NYRA_DB_RENEWAL_OWNER_DECISION_MARGIN';noAutomaticRetry=$true}}
        'unknown-code' {$F.code=$Canary;$ExpectedVerified=$false}
        'unknown-field' {$F|Add-Member -NotePropertyName secret -NotePropertyValue $Canary;$ExpectedVerified=$false}
        'unknown-stage' {$F.stage=$Canary;$ExpectedVerified=$false}
        'missing-field' {$F.PSObject.Properties.Remove('phase');$ExpectedVerified=$false}
        'string-bool' {$F.nativeRenewalInvoked='false';$ExpectedVerified=$false}
        'string-no-retry' {$F.noAutomaticRetry='true';$ExpectedVerified=$false}
        'nested-secret' {$F.renewalFailure=$Canary;$ExpectedVerified=$false}
        'nested-extra' {$F.code='NATIVE_RENEWAL_FAILED';$F.nativeRenewalInvoked=$true;$F.renewalFailure=[pscustomobject]@{marker='NYRA_DB_RENEWAL_DENIED';stage='DATABASE_ROTATION';code='NYRA_DB_RENEWAL_COMMAND_DENIED';noAutomaticRetry=$true;secret=$Canary};$ExpectedVerified=$false}
        'lock' {$script:FakeExit=75;$ExpectedVerified=$false;$ExpectedCategory='LOCKING'}
        'ssh' {$script:FakeExit=255;$ExpectedVerified=$false;$ExpectedCategory='TRANSPORT'}
    }
    $script:Frame=$F|ConvertTo-Json -Depth 20 -Compress
    switch($Case) {
        'duplicate-key' {$script:Frame=$script:Frame.Replace('"phase":','"phase":"OWNER_AUTHORIZED","phase":');$ExpectedVerified=$false}
        'case-duplicate-key' {$script:Frame=$script:Frame.Replace('"phase":','"Phase":"OWNER_AUTHORIZED","phase":');$ExpectedVerified=$false}
        'escaped-key' {$script:Frame=$script:Frame.Replace('"phase":','"ph\u0061se":');$ExpectedVerified=$false}
        'malformed-json' {$script:Frame=$Canary;$ExpectedVerified=$false}
        'oversized' {$script:Frame=(' '*65537)+$script:Frame;$ExpectedVerified=$false}
        'empty' {$script:Frame='';$ExpectedVerified=$false}
        'lock' {$script:Frame=''}
        'ssh' {$script:Frame=''}
    }
    $Checkpoint='RenewDiscovery';$Source='8b82cc964bdbc1919caf91c2669ca154204c025d';$Remote='/TEST_ONLY';$ReviewSHA256='a'*64;$ApprovalSHA256='b'*64;$Options=@();$DiscoveryActions=@{RenewDiscovery='renew'}
    $Caught=$false
    try {$null=. $StepPath 6>&1} catch {if ($_.Exception.Message -cne 'DISCOVERY_PROTECTED_OPERATION_CLOSED_RETURN_SANITIZED_OUTPUT_ONLY') {throw};$Caught=$true}
    if (!$Caught) {throw 'MISSING_FAIL_CLOSED_STOP'}
    $File=Join-Path $Pass 'discovery-failure.json'
    $Text=[IO.File]::ReadAllText($File);$R=$Text|ConvertFrom-Json
    if ($Text.Contains($Canary) -or $R.remoteReportVerified -ne $ExpectedVerified -or $R.noAutomaticRetry -ne $true -or $R.overall -cne 'INCOMPLETE') {throw ('SCHEMA_OR_SECRET_REGRESSION_'+$Case)}
    if ($ExpectedVerified -or $Case -in @('lock','ssh')) {if ($R.category -cne $ExpectedCategory) {throw ('CATEGORY_'+$Case)}}
    if ($null -ne $Payload -or $null -ne $Bearer) {throw 'SECRET_CLEANUP_REGRESSION'}
    if (!(Test-Path -LiteralPath (Join-Path $Pass 'FAILURE-SHA256SUMS'))) {throw 'MISSING_FAILURE_MANIFEST'}
    $Results+=@{case=$Case;result='PASS';remoteReportVerified=$R.remoteReportVerified}
}
[ordered]@{passed=$Results.Count;failed=0;results=$Results;actualSSH=$false;actualCredentialsIssued=0;actualProtectedOperations=0;testedPowerShell=$PSVersionTable.PSVersion.ToString();nativeWindows51Executed=($PSVersionTable.PSVersion.Major -eq 5 -and $PSVersionTable.PSEdition -eq 'Desktop')}|ConvertTo-Json -Depth 20

# GitHub Windows shell exits LASTEXITCODE; clear only the synthetic SSH code after every assertion passed.
$global:LASTEXITCODE=0
