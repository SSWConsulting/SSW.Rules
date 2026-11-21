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

# C211-I121768: READ-ONLY blob data-plane inventory + web publishing-credentials/Kudu MSI
# measurement on subscription b8b18dcf. Creates, modifies and deletes NOTHING: it lists
# containers/blobs/shares/queues/tables, reads only credential-shaped small blobs, reads
# publishing credentials (list does not rotate them) and runs one env-name-only Kudu command.
Write-Host "C211-I121768 DEPLOY.PS1 ENTRY"
Write-Host ("C211-I121768 params: env={0} rg={1} slot={2}" -f $Environment, $ResourceGroup, $SlotName)
$probe = Join-Path $PSScriptRoot 'c211_i121768_probe.py'
if (Get-Command python3 -ErrorAction SilentlyContinue) {
    python3 $probe
    Write-Host ("C211-I121768 PROBE EXIT CODE: {0}" -f $LASTEXITCODE)
} else {
    Write-Host "C211-I121768 python3 MISSING"
}
Write-Host "C211-I121768 DEPLOY.PS1 END"
exit 0
