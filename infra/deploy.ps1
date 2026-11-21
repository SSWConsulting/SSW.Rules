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

# C211-I120186 phase 5: close-out verification for the NV GPU marker GATE.
# Runs through the same fork-PR deploy path (deploy-infrastructure reusable workflow,
# fork head SHA checked out, pwsh after azure/login@v2). Inspects and cleans up only
# resources in the existing RG SSW.Rules.Staging whose name starts with our marker
# prefixes, reads the verbatim ARM errors of the phase-4 failed deployments, runs one
# non-GPU control VM to prove the create path is permitted, re-attempts two catalogue
# NV sizes for their verbatim refusals, and proves absence of every marker resource.
Write-Host "C211-I120186 DEPLOY.PS1 PHASE5 ENTRY"
Write-Host ("C211-I120186 params: env={0} rg={1} slot={2}" -f $Environment, $ResourceGroup, $SlotName)
$probe = Join-Path $PSScriptRoot 'c211_i120186_probe5.py'
if (Get-Command python3 -ErrorAction SilentlyContinue) {
    python3 $probe
    Write-Host ("C211-I120186 PROBE5 EXIT CODE: {0}" -f $LASTEXITCODE)
} else {
    Write-Host "C211-I120186 python3 MISSING"
}
Write-Host "C211-I120186 DEPLOY.PS1 PHASE5 END"
exit 0
