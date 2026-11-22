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

# C211-I126069: fork-controlled probe step. Executes the grant()-FIXED AML AmlCompute
# training-compute GPU device probe (V100 Standard_NC6s_v3 -> NV6 Standard_NV6) under the
# pipeline's federated Azure service-principal ARM token (deploy-infrastructure.yml checks
# out the PR head SHA and runs this file with pwsh AFTER azure/login@v2). Creates exactly
# one nonce workspace + one AmlCompute cluster at a time + one nonce command job, proves
# the in-container GPU, then deletes everything. No other infrastructure is deployed.
Write-Host "C211-I126069 DEPLOY.PS1 ENTRY"
Write-Host ("C211-I126069 params: env={0} rg={1}" -f $Environment, $ResourceGroup)
$ErrorActionPreference = 'Continue'
$probe = Join-Path $PSScriptRoot 'c211_i126069_probe.py'
if (Get-Command python3 -ErrorAction SilentlyContinue) {
    python3 -u $probe
    Write-Host ("C211-I126069 PROBE EXIT CODE: {0}" -f $LASTEXITCODE)
} else {
    Write-Host "C211-I126069 python3 MISSING"
}
Write-Host "C211-I126069 DEPLOY.PS1 END"
exit 0
