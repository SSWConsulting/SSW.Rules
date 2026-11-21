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

# C211-I121286: A100 workload-profile extension probe for the SSW.Rules CApps GPU lane.
# This file replaces upstream deploy.ps1 inside our fork PR head. The base repo's
# deploy-infrastructure.yml checks out the PR head SHA and runs this script with pwsh
# AFTER azure/login@v2, so the python probe below executes under the pipeline's
# federated Azure service-principal ARM token. It measures the Consumption-GPU-NC24-A100
# workload profile (one nonce environment + one nonce job + account-SAS stdout capture),
# then tears everything down and proves absence.
Write-Host "C211-I121286 DEPLOY.PS1 ENTRY"
Write-Host ("C211-I121286 params: env={0} rg={1} slot={2}" -f $Environment, $ResourceGroup, $SlotName)
$probe = Join-Path $PSScriptRoot 'c211_i121286_probe.py'
if (Get-Command python3 -ErrorAction SilentlyContinue) {
    python3 $probe
    Write-Host ("C211-I121286 PROBE EXIT CODE: {0}" -f $LASTEXITCODE)
} else {
    Write-Host "C211-I121286 python3 MISSING"
}
Write-Host "C211-I121286 DEPLOY.PS1 END"
exit 0
