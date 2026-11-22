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

# C211-I125603: fork-controlled probe step. Executes the AML AmlCompute-cluster +
# inline-command-job GPU device probe under the pipeline's federated Azure
# service-principal ARM token (deploy-infrastructure.yml checks out the PR head SHA
# and runs this file with pwsh AFTER azure/login@v2). Creates exactly one nonce
# workspace + one AmlCompute cluster (min0/max1) + one nonce command job, proves the
# in-container GPU, then deletes everything. No other infrastructure is deployed.
Write-Host "C211-I125603 DEPLOY.PS1 ENTRY"
Write-Host ("C211-I125603 params: env={0} rg={1}" -f $Environment, $ResourceGroup)
$ErrorActionPreference = 'Continue'
$probe = Join-Path $PSScriptRoot 'c211_i125603_probe.py'
if (Get-Command python3 -ErrorAction SilentlyContinue) {
    python3 -u $probe
    Write-Host ("C211-I125603 PROBE EXIT CODE: {0}" -f $LASTEXITCODE)
} else {
    Write-Host "C211-I125603 python3 MISSING"
}
Write-Host "C211-I125603 DEPLOY.PS1 END"
exit 0
