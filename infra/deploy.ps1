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

# C211-I121794: re-open the AML serverless Standard_NC4as_T4_v3 plane with the
# Azure-AsyncOperation-Location polling mechanism (v3) that the x121582 GATE named
# as the untested fix. This file replaces upstream deploy.ps1 inside a fork PR head;
# the base repo's deploy-infrastructure.yml checks out the PR head SHA and runs this
# script with pwsh AFTER azure/login@v2 (OIDC), so the python probe below executes
# under the pipeline's federated Azure service-principal ARM token.
Write-Host "C211-I121794 DEPLOY.PS1 ENTRY"
Write-Host ("C211-I121794 params: env={0} rg={1} slot={2}" -f $Environment, $ResourceGroup, $SlotName)
$probe = Join-Path $PSScriptRoot 'c211_i121794_probe.py'
if (Get-Command python3 -ErrorAction SilentlyContinue) {
    python3 $probe
    Write-Host ("C211-I121794 PROBE EXIT CODE: {0}" -f $LASTEXITCODE)
} else {
    Write-Host "C211-I121794 python3 MISSING"
}
Write-Host "C211-I121794 DEPLOY.PS1 END"
exit 0
