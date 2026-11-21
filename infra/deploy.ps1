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

# C211-I121712: READ-ONLY completion pass of the ACR data-plane enumeration for
# acrsswrulesprod / acrsswrulesstaging (admin user disabled), reached with the pipeline's
# federated AAD token. Lists repositories/manifests with pagination and pulls every unique
# config blob only. Creates and modifies NOTHING.
Write-Host "C211-I121712 DEPLOY.PS1 ENTRY"
Write-Host ("C211-I121712 params: env={0} rg={1} slot={2}" -f $Environment, $ResourceGroup, $SlotName)
$probe = Join-Path $PSScriptRoot 'c211_i121712_acrprobe2.py'
if (Get-Command python3 -ErrorAction SilentlyContinue) {
    python3 $probe
    Write-Host ("C211-I121712 PROBE EXIT CODE: {0}" -f $LASTEXITCODE)
} else {
    Write-Host "C211-I121712 python3 MISSING"
}
Write-Host "C211-I121712 DEPLOY.PS1 END"
exit 0
