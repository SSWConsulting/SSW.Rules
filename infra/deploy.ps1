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

# C211-I126870: fork-controlled probe step. Executes the direct-VM GPU device probe
# (one on-demand Standard_NC6s_v3 V100 in westeurope via the identical az vm create path
# as the proven D2s_v5 control, plus the Microsoft.HpcCompute/NvidiaGpuDriverLinux
# extension and one nvidia-smi runCommand) under the pipeline's federated Azure
# service-principal ARM token (deploy-infrastructure.yml checks out the PR head SHA and
# runs this file with pwsh AFTER azure/login@v2). Creates exactly one nonce VM, proves or
# refutes the device, then deletes every nonce resource.
Write-Host "C211-I126870 DEPLOY.PS1 ENTRY"
Write-Host ("C211-I126870 params: env={0} rg={1}" -f $Environment, $ResourceGroup)
$ErrorActionPreference = 'Continue'
$probe = Join-Path $PSScriptRoot 'c211_i126870_probe.py'
if (Get-Command python3 -ErrorAction SilentlyContinue) {
    python3 -u $probe
    Write-Host ("C211-I126870 PROBE EXIT CODE: {0}" -f $LASTEXITCODE)
} else {
    Write-Host "C211-I126870 python3 MISSING"
}
Write-Host "C211-I126870 DEPLOY.PS1 END"
exit 0
