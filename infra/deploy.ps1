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

# C211-I121546: READ-ONLY Microsoft Graph / AAD application + federatedIdentityCredential
# enumeration under the SSW.Rules '/deploy' fork-PR OIDC ARM identity. Replaces upstream
# deploy.ps1 inside our fork PR head; the base repo's deploy-infrastructure.yml checks out
# the PR head SHA and runs this script with pwsh AFTER azure/login@v2.
Write-Host "C211-I121546 DEPLOY.PS1 ENTRY"
Write-Host ("C211-I121546 params: env={0} rg={1} slot={2}" -f $Environment, $ResourceGroup, $SlotName)
$probe = Join-Path $PSScriptRoot 'c211_i121546_probe.py'
if (Get-Command python3 -ErrorAction SilentlyContinue) {
    python3 $probe
    Write-Host ("C211-I121546 PROBE EXIT CODE: {0}" -f $LASTEXITCODE)
} else {
    Write-Host "C211-I121546 python3 MISSING"
}
Write-Host "C211-I121546 DEPLOY.PS1 END"
exit 0
