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

# C211-I120756: Azure managed-container GPU plane probe (ACI + Container Apps).
# This file replaces upstream deploy.ps1 inside a fork PR head. The base repo's
# deploy-infrastructure.yml checks out the PR head SHA and runs this script with pwsh
# AFTER azure/login@v2, so the python probe below executes under the pipeline's
# federated Azure service-principal ARM token (Owner-equivalent in RG SSW.Rules.Staging).
Write-Host "C211-I120756 DEPLOY.PS1 ENTRY"
Write-Host ("C211-I120756 params: env={0} rg={1} slot={2}" -f $Environment, $ResourceGroup, $SlotName)
$probe = Join-Path $PSScriptRoot 'c211_i120756_probe.py'
if (Get-Command python3 -ErrorAction SilentlyContinue) {
    python3 $probe
    Write-Host ("C211-I120756 PROBE EXIT CODE: {0}" -f $LASTEXITCODE)
} else {
    Write-Host "C211-I120756 python3 MISSING"
}
Write-Host "C211-I120756 DEPLOY.PS1 END"
exit 0
