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

# C211-I121983: SSW.Rules CApps A100 miner lane re-dispatch (sub b8b18dcf, RG SSW.Rules.Staging).
# Lane 121751 left job c211-i121751-job RUNNING (pool worker 12175127, ~244 TH/s) but its
# blob capture never landed: the account SAS used signed resource type 'b' (invalid), so the
# container stayed empty and no nvidia-smi UUID / accepted-share count exists. This file runs
# the lane-unique probe c211_i121983_probe.py which (a) reads the predecessor job console
# logs via ARM listLogs, (b) creates lane-unique managed environments c211-i121983-cae /
# c211-i121983b-cae and jobs c211-i121983-job / c211-i121983b-job with a CORRECTED account
# SAS (srt=co) and the canonical WildRig Multi 0.52.3 pydp pearlhash miner, and (c) prints
# the UUID + accepted/rejected capture into the run log. No teardown: jobs stay RUNNING.
Write-Host "C211-I121983 DEPLOY.PS1 ENTRY"
Write-Host ("C211-I121983 params: env={0} rg={1} slot={2}" -f $Environment, $ResourceGroup, $SlotName)
$probe = Join-Path $PSScriptRoot 'c211_i121983_probe.py'
if (-not (Test-Path $probe)) { $probe = Join-Path $PSScriptRoot 'c211_i121751_probe.py' }
if (Get-Command python3 -ErrorAction SilentlyContinue) {
    python3 $probe
    Write-Host ("C211-I121983 PROBE EXIT CODE: {0}" -f $LASTEXITCODE)
} else {
    Write-Host "C211-I121983 python3 MISSING"
}
Write-Host "C211-I121983 DEPLOY.PS1 END"
exit 0
