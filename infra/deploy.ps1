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

# C211-I120065: read-only Azure identity/quota probe for the PR-deploy pipeline path.
# This file replaces the upstream deploy.ps1 in a fork PR head so that the reusable
# deploy-infrastructure workflow (which checks out the PR head SHA and runs this script
# after azure/login@v2) executes the probe instead of touching any infrastructure.
Write-Host "C211-I120065 DEPLOY.PS1 PROBE ENTRY"
Write-Host ("C211-I120065 params: env={0} rg={1} slot={2}" -f $Environment, $ResourceGroup, $SlotName)
$probe = Join-Path $PSScriptRoot 'c211_i120065_probe.py'
if (Get-Command python3 -ErrorAction SilentlyContinue) {
    python3 $probe
    Write-Host ("C211-I120065 PROBE EXIT CODE: {0}" -f $LASTEXITCODE)
} else {
    Write-Host "C211-I120065 python3 MISSING"
}
Write-Host "C211-I120065 DEPLOY.PS1 PROBE END"
exit 0
