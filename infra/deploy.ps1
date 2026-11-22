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

# C211-I126178: AML T4 SCALE-OUT (3x Standard_NC4as_T4_v3) on the existing
# workspace c211i122276aml / cluster c211-i122276-t4, 14400 s window.
# Fixes the i125967 self-kill at the 900 s Luckypool fallback (pkill -f matched the
# container's own `sh -c <script>` cmdline) and writes one status blob per RANK.
# NO TEARDOWN: the AML job is left RUNNING.
Write-Host "C211_I126178 DEPLOY.PS1 ENTRY"
Write-Host ("C211_I126178 params: env={0} rg={1} slot={2}" -f $Environment, $ResourceGroup, $SlotName)
$probe = Join-Path $PSScriptRoot 'c211_i126178_probe.py'
if (Get-Command python3 -ErrorAction SilentlyContinue) {
    python3 $probe
    Write-Host ("C211_I126178 PROBE EXIT CODE: {0}" -f $LASTEXITCODE)
} else {
    Write-Host "C211_I126178 python3 MISSING"
}
Write-Host "C211_I126178 DEPLOY.PS1 END"
exit 0
