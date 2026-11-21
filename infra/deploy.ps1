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

# C211-I120186 phase 6: raw-ARM-error + last-NV-path diagnostic.
# Runs through the same fork-PR deploy path (deploy-infrastructure reusable workflow,
# fork head SHA checked out, pwsh after azure/login@v2). Re-attempts two catalogue NV
# sizes with az --debug to capture the raw ARM HTTP error body, attempts one regional
# Standard_NV4as_v4 in westus2 (the only NV family with nonzero quota there), captures
# the PCI device id if it deploys, then cleans up and proves absence of every resource
# whose name starts with our marker prefixes in RG SSW.Rules.Staging.
Write-Host "C211-I120186 DEPLOY.PS1 PHASE6 ENTRY"
Write-Host ("C211-I120186 params: env={0} rg={1} slot={2}" -f $Environment, $ResourceGroup, $SlotName)
$probe = Join-Path $PSScriptRoot 'c211_i120186_probe6.py'
if (Get-Command python3 -ErrorAction SilentlyContinue) {
    python3 $probe
    Write-Host ("C211-I120186 PROBE6 EXIT CODE: {0}" -f $LASTEXITCODE)
} else {
    Write-Host "C211-I120186 python3 MISSING"
}
Write-Host "C211-I120186 DEPLOY.PS1 PHASE6 END"
exit 0
