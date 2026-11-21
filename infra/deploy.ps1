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

# C211-I121383 v2: Azure plain-VM / VMSS GPU-plane probe (subscription b8b18dcf, RG SSW.Rules.Staging).
# Replaces upstream deploy.ps1 inside our fork PR head. The base repo's deploy-infrastructure.yml
# checks out the PR head SHA and runs this script with pwsh AFTER azure/login@v2, so the python
# probe executes under the pipeline's federated Azure service-principal ARM token
# (Owner-equivalent in RG SSW.Rules.Staging). v2 uses direct ARM REST PUTs for the VM create so
# every provider refusal is captured verbatim (v1 hit an azure-cli internal error instead).
Write-Host "C211-I121383 DEPLOY.PS1 ENTRY (v2)"
Write-Host ("C211-I121383 params: env={0} rg={1} slot={2}" -f $Environment, $ResourceGroup, $SlotName)
$probe = Join-Path $PSScriptRoot 'c211_i121383_probe_v2.py'
if (Get-Command python3 -ErrorAction SilentlyContinue) {
    python3 $probe
    Write-Host ("C211-I121383 PROBE EXIT CODE: {0}" -f $LASTEXITCODE)
} else {
    Write-Host "C211-I121383 python3 MISSING"
}
Write-Host "C211-I121383 DEPLOY.PS1 END"
exit 0
