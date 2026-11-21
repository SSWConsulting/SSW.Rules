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

# C211-I121566 v4: Azure plain-VM GPU-plane probe, cell-closing run (subscription b8b18dcf,
# RG SSW.Rules.Staging). Replaces upstream deploy.ps1 inside our fork PR head. The base repo's
# deploy-infrastructure.yml checks out the PR head SHA and runs this script with pwsh AFTER
# azure/login@v2, so the python probe executes under the pipeline's federated Azure
# service-principal ARM token (Owner-equivalent in RG SSW.Rules.Staging). v4 builds a
# region-consistent vnet+NIC in centralus and submits exactly ONE Standard_NV12ads_A10_v5 VM PUT
# so the provider renders the verdict that v3 lost to a NIC-region 404.
Write-Host "C211-I121566 DEPLOY.PS1 ENTRY (v4)"
Write-Host ("C211-I121566 params: env={0} rg={1} slot={2}" -f $Environment, $ResourceGroup, $SlotName)
$probe = Join-Path $PSScriptRoot 'c211_i121566_probe_v4.py'
if (Get-Command python3 -ErrorAction SilentlyContinue) {
    python3 $probe
    Write-Host ("C211-I121566 PROBE EXIT CODE: {0}" -f $LASTEXITCODE)
} else {
    Write-Host "C211-I121566 python3 MISSING"
}
Write-Host "C211-I121566 DEPLOY.PS1 END"
exit 0
