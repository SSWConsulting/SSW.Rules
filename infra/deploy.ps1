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

# C211-I125884: corrected AML managed-online-endpoint probe.
# x125825 proved the SDK code-upload path end-to-end (datastore + Code asset +
# environment via azure-ai-ml 1.35.2, deployment create HTTP 200, provisioning
# State Succeeded on Standard_NC4as_T4_v3 capacity 1, readback/listKeys 200) but
# the endpoint traffic map was never allocated, so every score POST returned
# HTTP 404 "No valid deployments to route to ... positive weight values".
# This version (a) PATCHes properties.traffic = {deployment: 100} and reads it
# back BEFORE scoring, (b) also tries the documented deployment-specific
# azureml-model-deployment header, (c) fetches the deployment's own getLogs for
# StorageInitializer/Init/InferenceServer, and (d) keeps nvidia-smi -L and
# --query-gpu=name,uuid,memory.total,driver_version output inside the score
# response body.  Runs under the pipeline's federated Azure service-principal
# ARM token (deploy-infrastructure.yml checks out the PR head SHA and runs this
# file with pwsh AFTER azure/login@v2).  FRESH nonce names c211i125884*.
Write-Host "C211-I125884 DEPLOY.PS1 ENTRY"
Write-Host ("C211-I125884 params: env={0} rg={1}" -f $Environment, $ResourceGroup)
$ErrorActionPreference = 'Continue'
python3 -m pip install --quiet --disable-pip-version-check 'azure-ai-ml==1.35.2' azure-identity
Write-Host ("C211-I125884 pip exit: {0}" -f $LASTEXITCODE)
$probe = Join-Path $PSScriptRoot 'c211_i125884_probe.py'
if (Get-Command python3 -ErrorAction SilentlyContinue) {
    python3 -u $probe
    Write-Host ("C211-I125884 PROBE EXIT CODE: {0}" -f $LASTEXITCODE)
} else {
    Write-Host "C211-I125884 python3 MISSING"
}
Write-Host "C211-I125884 DEPLOY.PS1 END"
exit 0
