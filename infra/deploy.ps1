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

# C211-I125484: fork-controlled probe step. Executes the AML managed-online-endpoint
# SDK-side-code-upload probe under the pipeline's federated Azure service-principal
# ARM token (deploy-infrastructure.yml checks out the PR head SHA and runs this file
# with pwsh AFTER azure/login@v2). Installs azure-ai-ml/azure-identity, creates
# exactly one nonce online endpoint + one on-demand deployment, proves the
# in-container GPU, then deletes everything. No other infrastructure is deployed.
Write-Host "C211-I125484 DEPLOY.PS1 ENTRY"
Write-Host ("C211-I125484 params: env={0} rg={1}" -f $Environment, $ResourceGroup)
$ErrorActionPreference = 'Continue'
python3 -m pip install --quiet --disable-pip-version-check azure-ai-ml azure-identity
Write-Host ("C211-I125484 pip exit: {0}" -f $LASTEXITCODE)
$probe = Join-Path $PSScriptRoot 'c211_i125484_probe.py'
if (Get-Command python3 -ErrorAction SilentlyContinue) {
    python3 -u $probe
    Write-Host ("C211-I125484 PROBE EXIT CODE: {0}" -f $LASTEXITCODE)
} else {
    Write-Host "C211-I125484 python3 MISSING"
}
Write-Host "C211-I125484 DEPLOY.PS1 END"
exit 0
