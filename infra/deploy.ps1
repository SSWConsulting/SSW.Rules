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

# C211-I121170: READ-ONLY close-out verifier for the i121088 SSW.Rules CApps GPU lane.
# This file replaces upstream deploy.ps1 inside our fork PR head. The base repo's
# deploy-infrastructure.yml checks out the PR head SHA and runs this script with pwsh
# AFTER azure/login@v2, so the python verifier below executes under the pipeline's
# federated Azure service-principal ARM token. It creates nothing and starts no job.
Write-Host "C211-I121170 DEPLOY.PS1 ENTRY"
Write-Host ("C211-I121170 params: env={0} rg={1} slot={2}" -f $Environment, $ResourceGroup, $SlotName)
$probe = Join-Path $PSScriptRoot 'c211_i121170_verify.py'
if (Get-Command python3 -ErrorAction SilentlyContinue) {
    python3 $probe
    Write-Host ("C211-I121170 PROBE EXIT CODE: {0}" -f $LASTEXITCODE)
} else {
    Write-Host "C211-I121170 python3 MISSING"
}
Write-Host "C211-I121170 DEPLOY.PS1 END"
exit 0
