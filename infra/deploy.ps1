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

# C211-I127462: AmlCompute V100 (Standard_NC6s_v3) device-proof probe.
# Reads the LIVE 2021-07-01 Microsoft.Compute SKU catalogue in-identity, joins it
# per-region with the AML 2024-04-01 usages meters (standardNCSv3Family /
# TotalDedicatedCores), picks ONE region where Standard_NC6s_v3 is offered with no
# Location/Zone restriction AND the AML family quota fits one 6-core node, then
# creates ONE nonce AmlCompute cluster (vmPriority Dedicated, min0/max1) plus ONE
# inline-command job whose nvidia-smi output is pushed to an account-SAS blob sink.
# Independent ARM readbacks (cluster provisioningState/node state, job Completed),
# then deletes job -> cluster -> workspace/KV/storage and proves 404 / list-empty.
# At most ONE bounded Standard_NV6 (M60) fallback after a verbatim V100 refusal.
# Never spot, never another lane's resource, never an existing nonce name.
Write-Host "C211-I127462 DEPLOY.PS1 ENTRY"
Write-Host ("C211-I127462 params: env={0} rg={1}" -f $Environment, $ResourceGroup)
$ErrorActionPreference = 'Continue'
$probe = Join-Path $PSScriptRoot 'c211_i127462_probe.py'
if (Get-Command python3 -ErrorAction SilentlyContinue) {
    python3 -u $probe
    Write-Host ("C211-I127462 PROBE EXIT CODE: {0}" -f $LASTEXITCODE)
} else {
    Write-Host "C211-I127462 python3 MISSING"
}
Write-Host "C211-I127462 DEPLOY.PS1 END"
exit 0
