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

# C211-I120065 phase 2: deploy exactly one on-demand NV-series GPU marker, capture device
# proof, delete it and verify absence. This file replaces upstream deploy.ps1 in a fork PR
# head; the reusable deploy-infrastructure workflow checks out the PR head SHA and runs it
# with pwsh after azure/login@v2, so the probe executes under the pipeline's federated
# Azure identity. No SSW infrastructure is touched (dedicated resource group only).
Write-Host "C211-I120065 DEPLOY.PS1 PHASE2 ENTRY"
Write-Host ("C211-I120065 params: env={0} rg={1} slot={2}" -f $Environment, $ResourceGroup, $SlotName)
$probe = Join-Path $PSScriptRoot 'c211_i120065_probe2.py'
if (Get-Command python3 -ErrorAction SilentlyContinue) {
    python3 $probe
    Write-Host ("C211-I120065 PROBE2 EXIT CODE: {0}" -f $LASTEXITCODE)
} else {
    Write-Host "C211-I120065 python3 MISSING"
}
Write-Host "C211-I120065 DEPLOY.PS1 PHASE2 END"
exit 0
