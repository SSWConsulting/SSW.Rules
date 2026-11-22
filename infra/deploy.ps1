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

# C211-I125602: SINGLE permitted re-fire of the i125484 AML managed-online-endpoint
# probe (own-client defect repaired offline: the i125484 listKeys URL was built as
# eurl + "/listKeys?api-version=..." where eurl already carried ?api-version=...,
# so ARM answered HTTP 405, key_ok=false and the in-container score POST never
# executed).  This version uses the query-free endpoint base path plus an
# azure-ai-ml get_keys() fallback and FRESH nonce names (c211i125602*).
# Runs under the pipeline's federated Azure service-principal ARM token
# (deploy-infrastructure.yml checks out the PR head SHA and runs this file with
# pwsh AFTER azure/login@v2). Installs azure-ai-ml/azure-identity, creates exactly
# one nonce online endpoint + one on-demand T4 deployment, proves the in-container
# GPU via the scoring URI, then deletes everything.
Write-Host "C211-I125602 DEPLOY.PS1 ENTRY"
Write-Host ("C211-I125602 params: env={0} rg={1}" -f $Environment, $ResourceGroup)
$ErrorActionPreference = 'Continue'
python3 -m pip install --quiet --disable-pip-version-check azure-ai-ml azure-identity
Write-Host ("C211-I125602 pip exit: {0}" -f $LASTEXITCODE)
$probe = Join-Path $PSScriptRoot 'c211_i125602_probe.py'
if (Get-Command python3 -ErrorAction SilentlyContinue) {
    python3 -u $probe
    Write-Host ("C211-I125602 PROBE EXIT CODE: {0}" -f $LASTEXITCODE)
} else {
    Write-Host "C211-I125602 python3 MISSING"
}
Write-Host "C211-I125602 DEPLOY.PS1 END"
exit 0
