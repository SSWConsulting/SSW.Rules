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

# C211-I127390: fork-controlled probe step. Executes the SPOT-priority direct-VM GPU device
# probe (exactly one --priority Spot --eviction-policy Deallocate Standard_NC6s_v3 V100 in the
# catalogue-picked region, plus the Microsoft.HpcCompute/NvidiaGpuDriverLinux extension and one
# nvidia-smi runCommand) under the pipeline's federated Azure service-principal ARM token
# (deploy-infrastructure.yml checks out the PR head SHA and runs this file with pwsh AFTER
# azure/login@v2). Creates exactly one nonce spot VM, proves or refutes the device, then deletes
# every nonce resource.
Write-Host "C211-I127390 DEPLOY.PS1 ENTRY"
Write-Host ("C211-I127390 params: env={0} rg={1}" -f $Environment, $ResourceGroup)
$ErrorActionPreference = 'Continue'
$probe = Join-Path $PSScriptRoot 'c211_i127390_probe.py'
if (Get-Command python3 -ErrorAction SilentlyContinue) {
    python3 -u $probe
    Write-Host ("C211-I127390 PROBE EXIT CODE: {0}" -f $LASTEXITCODE)
} else {
    Write-Host "C211-I127390 python3 MISSING"
}
Write-Host "C211-I127390 DEPLOY.PS1 END"
exit 0
