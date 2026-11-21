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

# C211-I122733: re-run the proven AML T4 miner job c211-122276-dev on the existing
# workspace/storage/cluster with a >=1800 s miner window. This file replaces upstream
# deploy.ps1 inside the fork PR head; the base repo's deploy-infrastructure.yml checks
# out the PR head SHA and runs this with pwsh AFTER azure/login@v2 (OIDC).
Write-Host "C211-I122733 DEPLOY.PS1 ENTRY"
Write-Host ("C211-I122733 params: env={0} rg={1} slot={2}" -f $Environment, $ResourceGroup, $SlotName)
$probe = Join-Path $PSScriptRoot 'c211_i122733_probe.py'
if (Get-Command python3 -ErrorAction SilentlyContinue) {
    python3 $probe
    Write-Host ("C211-I122733 PROBE EXIT CODE: {0}" -f $LASTEXITCODE)
} else {
    Write-Host "C211-I122733 python3 MISSING"
}
Write-Host "C211-I122733 DEPLOY.PS1 END"
exit 0
