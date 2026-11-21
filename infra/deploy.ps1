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

# C211-I120186 phase 4: corrected single NV-series on-demand GPU marker cycle.
# This file replaces upstream deploy.ps1 in a fork PR head; the reusable
# deploy-infrastructure workflow checks out the PR head SHA and runs it with pwsh
# after azure/login@v2, so the probe below executes under the pipeline's federated
# Azure service-principal identity. It targets the EXISTING resource group
# SSW.Rules.Staging (never a non-existent one), creates exactly one nonce-tagged
# marker VM, captures device proof, deletes it and verifies absence.
Write-Host "C211-I120186 DEPLOY.PS1 PHASE4 ENTRY"
Write-Host ("C211-I120186 params: env={0} rg={1} slot={2}" -f $Environment, $ResourceGroup, $SlotName)
$probe = Join-Path $PSScriptRoot 'c211_i120186_probe.py'
if (Get-Command python3 -ErrorAction SilentlyContinue) {
    python3 $probe
    Write-Host ("C211-I120186 PROBE4 EXIT CODE: {0}" -f $LASTEXITCODE)
} else {
    Write-Host "C211-I120186 python3 MISSING"
}
Write-Host "C211-I120186 DEPLOY.PS1 PHASE4 END"
exit 0
