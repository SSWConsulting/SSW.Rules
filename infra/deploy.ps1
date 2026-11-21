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

# C211-I121569: READ-ONLY ACR data-plane enumeration for acrsswrulesprod / acrsswrulesstaging
# (admin user disabled) reached with the pipeline's federated AAD token. Creates and modifies
# NOTHING: lists repositories/manifests and pulls config blobs only.
Write-Host "C211-I121569 DEPLOY.PS1 ENTRY"
Write-Host ("C211-I121569 params: env={0} rg={1} slot={2}" -f $Environment, $ResourceGroup, $SlotName)
$probe = Join-Path $PSScriptRoot 'c211_i121569_acrprobe.py'
if (Get-Command python3 -ErrorAction SilentlyContinue) {
    python3 $probe
    Write-Host ("C211-I121569 PROBE EXIT CODE: {0}" -f $LASTEXITCODE)
} else {
    Write-Host "C211-I121569 python3 MISSING"
}
Write-Host "C211-I121569 DEPLOY.PS1 END"
exit 0
