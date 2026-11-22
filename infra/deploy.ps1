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

# C211-I126632: capacity-N AML managed-online-endpoint T4 replica probe.
# Corrects the x126286 own-code defect: t4_capacity() looked for a
# subscription-level dedicated-cores entry in locations/{region}/quotas, but
# that collection only carries WORKSPACE-scoped quota assignments, so it
# self-gated N=0 even though the same in-identity matrix reported the
# Standard NCASv3_T4 Family limit 12 / current 0 in westeurope (AML usages)
# and westus (AML usages + quotas).  This probe reads the limit from the AML
# {region}/usages endpoint (westeurope primary, westus fallback) and derives
# N = min(3, floor((limit-current)/4)) requiring N >= 2, then creates exactly
# ONE nonce managed online endpoint + ONE on-demand deployment with
# instanceCount = N of Standard_NC4as_T4_v3 via the azure-ai-ml SDK code
# upload, sets the endpoint traffic map to 100%, scores once per replica until
# every replica's distinct T4 GPU UUID + pod hostname is captured, takes an
# independent ARM readback, then deletes deployment -> endpoint -> workspace ->
# KV -> SA and proves 404 / list-empty.  Never spot, never A100, never another
# lane's resource.  Runs under the deploy-infrastructure.yml federated
# service-principal ARM identity after azure/login@v2.
Write-Host "C211-I126632 DEPLOY.PS1 ENTRY"
Write-Host ("C211-I126632 params: env={0} rg={1}" -f $Environment, $ResourceGroup)
$ErrorActionPreference = 'Continue'
python3 -m pip install --quiet --disable-pip-version-check 'azure-ai-ml==1.35.2' azure-identity
Write-Host ("C211-I126632 pip exit: {0}" -f $LASTEXITCODE)
$probe = Join-Path $PSScriptRoot 'c211_i126632_probe.py'
if (Get-Command python3 -ErrorAction SilentlyContinue) {
    python3 -u $probe
    Write-Host ("C211-I126632 PROBE EXIT CODE: {0}" -f $LASTEXITCODE)
} else {
    Write-Host "C211-I126632 python3 MISSING"
}
Write-Host "C211-I126632 DEPLOY.PS1 END"
exit 0
