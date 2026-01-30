<#
.SYNOPSIS
    Deploys SSW Rules infrastructure to Azure using Bicep templates.

.DESCRIPTION
    This script deploys Azure resources using a consistent naming pattern:
    - app-{project}-{env}     (App Service)
    - appi-{project}-{env}    (Application Insights)
    - log-{project}-{env}     (Log Analytics Workspace)
    - acr{project}{env}       (Container Registry - no hyphens allowed)
    - rg-{project}-{env}      (Resource Group)

.PARAMETER Environment
    The target environment (staging or prod)

.PARAMETER ServicePrincipalObjectId
    Object ID of the Service Principal to grant AcrPush role (for GitHub Actions)

.PARAMETER ResourceGroup
    The Azure resource group name to deploy resources to.

.PARAMETER WhatIf
    Show what would be deployed without actually deploying

.EXAMPLE
    ./deploy.ps1 -Environment staging -ResourceGroup "SSW.Rules.Staging"

.EXAMPLE
    ./deploy.ps1 -Environment staging -ResourceGroup "SSW.Rules.Staging" -ServicePrincipalObjectId "12345678-1234-1234-1234-123456789012"
    
.EXAMPLE
    ./deploy.ps1 -Environment prod -ResourceGroup "SSW.Rules" -WhatIf
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('staging', 'production')]
    [string]$Environment,

    [Parameter(Mandatory = $true)]
    [string]$ResourceGroup,

    [Parameter(Mandatory = $false)]
    [string]$ServicePrincipalObjectId = '',

    [Parameter(Mandatory = $false)]
    [switch]$WhatIf
)

# Set strict mode and error handling
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ============================================================================
# CONFIGURATION
# ============================================================================

$ProjectName = 'rules'

# Normalize 'production' to 'prod' for naming
if ($Environment -eq 'production') {
    $Environment = 'prod'
}

# Resource names derived from project + environment
$AppServiceName = "app-$ProjectName-$Environment"
$AppInsightsName = "appi-$ProjectName-$Environment"
$LogAnalyticsWorkspaceName = "log-$ProjectName-$Environment"
$ContainerRegistryName = "acr$ProjectName$Environment"

# App Service Plan - different per environment
if ($Environment -eq 'staging') {
    $AppServicePlanName = 'plan-ssw-shared-dev-linux'
    $AppServicePlanResourceGroup = 'SSW.AppServicePlans'
} else {
    $AppServicePlanName = "asp-$ProjectName-$Environment"
    $AppServicePlanResourceGroup = $ResourceGroup
}

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

function Write-Step {
    param([string]$Message)
    Write-Host "`n===> $Message" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "[OK] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Gray
}

function Test-AzureLogin {
    Write-Step "Verifying Azure login..."
    try {
        $account = az account show 2>&1 | ConvertFrom-Json
        Write-Success "Logged in as: $($account.user.name)"
        Write-Info "Subscription: $($account.name) ($($account.id))"
        return $true
    }
    catch {
        Write-Error "Not logged in to Azure. Please run 'az login' first."
        return $false
    }
}

function Test-ResourceExists {
    param(
        [string]$ResourceType,
        [string]$ResourceName,
        [string]$ResourceGroup
    )
    
    try {
        switch ($ResourceType) {
            'Microsoft.ContainerRegistry/registries' {
                $result = az acr show --name $ResourceName 2>&1
                return $LASTEXITCODE -eq 0
            }
            'Microsoft.Insights/components' {
                $result = az monitor app-insights component show --app $ResourceName --resource-group $ResourceGroup 2>&1
                return $LASTEXITCODE -eq 0
            }
            'Microsoft.OperationalInsights/workspaces' {
                $result = az monitor log-analytics workspace show --workspace-name $ResourceName --resource-group $ResourceGroup 2>&1
                return $LASTEXITCODE -eq 0
            }
            'Microsoft.Web/sites' {
                $result = az webapp show --name $ResourceName --resource-group $ResourceGroup 2>&1
                return $LASTEXITCODE -eq 0
            }
            'Microsoft.ManagedIdentity/userAssignedIdentities' {
                $result = az identity show --name $ResourceName --resource-group $ResourceGroup 2>&1
                return $LASTEXITCODE -eq 0
            }
            default {
                return $false
            }
        }
    }
    catch {
        return $false
    }
}

function Test-ResourceGroupExists {
    param([string]$ResourceGroupName)
    
    $result = az group exists --name $ResourceGroupName 2>&1
    return $result -eq 'true'
}

function New-ResourceGroup {
    param(
        [string]$ResourceGroupName,
        [string]$Location = 'australiaeast'
    )
    
    Write-Step "Creating resource group: $ResourceGroupName"
    az group create --name $ResourceGroupName --location $Location --output none
    Write-Success "Resource group created"
}

# ============================================================================
# MAIN SCRIPT
# ============================================================================

$spDisplay = if ($ServicePrincipalObjectId) { $ServicePrincipalObjectId } else { '(not provided - no AcrPush role)' }

Write-Host @"

================================================================================
  SSW Rules Infrastructure Deployment
================================================================================
  Environment:        $Environment
  Resource Group:     $ResourceGroup
  App Service:        $AppServiceName
  App Insights:       $AppInsightsName
  Log Analytics:      $LogAnalyticsWorkspaceName
  Container Registry: $ContainerRegistryName
  App Service Plan:   $AppServicePlanName (in $AppServicePlanResourceGroup)
  Service Principal:  $spDisplay
================================================================================

"@ -ForegroundColor White

# Verify Azure login
if (-not (Test-AzureLogin)) {
    exit 1
}

# Check if resource group exists
Write-Step "Checking resource group: $ResourceGroup"
$resourceGroupExists = Test-ResourceGroupExists -ResourceGroupName $ResourceGroup
if (-not $resourceGroupExists) {
    if ($WhatIf) {
        Write-Warning "Resource group does not exist - WOULD be created"
    }
    else {
        Write-Warning "Resource group does not exist. Creating..."
        New-ResourceGroup -ResourceGroupName $ResourceGroup
    }
}
else {
    Write-Success "Resource group exists"
}

# Check for existing resources (informational only - all resources are always deployed)
Write-Step "Checking for existing resources..."

# Check if Log Analytics Workspace exists
if (Test-ResourceExists -ResourceType 'Microsoft.OperationalInsights/workspaces' -ResourceName $LogAnalyticsWorkspaceName -ResourceGroup $ResourceGroup) {
    Write-Info "Log Analytics Workspace '$LogAnalyticsWorkspaceName' exists - will update"
}
else {
    Write-Info "Log Analytics Workspace '$LogAnalyticsWorkspaceName' - will create"
}

# Check if App Insights exists
if (Test-ResourceExists -ResourceType 'Microsoft.Insights/components' -ResourceName $AppInsightsName -ResourceGroup $ResourceGroup) {
    Write-Info "Application Insights '$AppInsightsName' exists - will update"
}
else {
    Write-Info "Application Insights '$AppInsightsName' - will create"
}

# Check if Container Registry exists
if (Test-ResourceExists -ResourceType 'Microsoft.ContainerRegistry/registries' -ResourceName $ContainerRegistryName -ResourceGroup $ResourceGroup) {
    Write-Info "Container Registry '$ContainerRegistryName' exists - will update"
}
else {
    Write-Info "Container Registry '$ContainerRegistryName' - will create"
}

# Check if App Service exists
if (Test-ResourceExists -ResourceType 'Microsoft.Web/sites' -ResourceName $AppServiceName -ResourceGroup $ResourceGroup) {
    Write-Info "App Service '$AppServiceName' exists - will update"
}
else {
    Write-Info "App Service '$AppServiceName' - will create"
}

# Verify App Service Plan exists
Write-Step "Verifying App Service Plan: $AppServicePlanName"
$planCheck = az appservice plan show --name $AppServicePlanName --resource-group $AppServicePlanResourceGroup 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "=================================================================================" -ForegroundColor Red
    Write-Host "  ERROR: App Service Plan not found!" -ForegroundColor Red
    Write-Host "=================================================================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "  Plan Name:      $AppServicePlanName" -ForegroundColor Yellow
    Write-Host "  Resource Group: $AppServicePlanResourceGroup" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  Possible causes:" -ForegroundColor White
    Write-Host "    - Wrong Azure subscription (check with 'az account show')" -ForegroundColor Gray
    Write-Host "    - App Service Plan doesn't exist" -ForegroundColor Gray
    Write-Host "    - Resource group name is incorrect" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  Current subscription:" -ForegroundColor White
    $currentSub = az account show --query "{name:name, id:id}" -o tsv 2>&1
    Write-Host "    $currentSub" -ForegroundColor Gray
    Write-Host ""
    Write-Host "=================================================================================" -ForegroundColor Red
    exit 1
}
Write-Success "App Service Plan found"

# Build deployment parameters
Write-Step "Preparing deployment parameters..."

$deploymentParams = @{
    environment = $Environment
    appServiceName = $AppServiceName
    appInsightsName = $AppInsightsName
    logAnalyticsWorkspaceName = $LogAnalyticsWorkspaceName
    containerRegistryName = $ContainerRegistryName
    appServicePlanName = $AppServicePlanName
    appServicePlanResourceGroup = $AppServicePlanResourceGroup
}

if ($ServicePrincipalObjectId) {
    $deploymentParams.servicePrincipalObjectId = $ServicePrincipalObjectId
}

# Convert to JSON for Bicep
$paramsJson = $deploymentParams | ConvertTo-Json -Compress

Write-Info "Parameters:"
$deploymentParams.GetEnumerator() | ForEach-Object {
    if ($_.Key -notlike '*ConnectionString*') {
        Write-Info "  $($_.Key): $($_.Value)"
    }
}

# Get script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$templatePath = Join-Path $scriptDir 'main.bicep'

# Verify template exists
if (-not (Test-Path $templatePath)) {
    Write-Error "Bicep template not found at: $templatePath"
    exit 1
}

# Deploy infrastructure
Write-Step "Deploying infrastructure..."

# In WhatIf mode, if resource group doesn't exist, we can't run the Bicep what-if
if ($WhatIf -and -not $resourceGroupExists) {
    Write-Host @"

================================================================================
  What-If Analysis Summary
================================================================================
  The following resources WOULD be created:
  
  1. Resource Group: $ResourceGroup (does not exist)
  2. Log Analytics Workspace: $LogAnalyticsWorkspaceName
  3. Application Insights: $AppInsightsName
  4. Container Registry: $ContainerRegistryName
  5. App Service: $AppServiceName
  
  Note: All resources are always deployed (created or updated).
  
  Note: Bicep what-if analysis requires the resource group to exist.
        Run without -WhatIf to create the resource group first, or create it manually.
================================================================================

"@ -ForegroundColor Yellow
    Write-Info "What-If analysis complete. No changes were made."
    Write-Host "`nDone!`n" -ForegroundColor Cyan
    exit 0
}

$deploymentName = "ssw-rules-infra-$Environment-$(Get-Date -Format 'yyyyMMddHHmmss')"

$azArgs = @(
    'deployment', 'group', 'create'
    '--name', $deploymentName
    '--resource-group', $ResourceGroup
    '--template-file', $templatePath
    '--parameters', "environment=$Environment"
    '--parameters', "appServiceName=$AppServiceName"
    '--parameters', "appInsightsName=$AppInsightsName"
    '--parameters', "logAnalyticsWorkspaceName=$LogAnalyticsWorkspaceName"
    '--parameters', "containerRegistryName=$ContainerRegistryName"
    '--parameters', "appServicePlanName=$AppServicePlanName"
    '--parameters', "appServicePlanResourceGroup=$AppServicePlanResourceGroup"
)

if ($ServicePrincipalObjectId) {
    $azArgs += '--parameters', "servicePrincipalObjectId=$ServicePrincipalObjectId"
}

if ($WhatIf) {
    $azArgs += '--what-if'
    Write-Info "Running in What-If mode (resource group exists, running Bicep what-if)..."
}
else {
    $azArgs += '--output', 'json'
}

Write-Info "Executing: az $($azArgs -join ' ')"

$result = & az @azArgs

if ($LASTEXITCODE -ne 0) {
    Write-Error "Deployment failed with exit code: $LASTEXITCODE"
    Write-Host $result
    exit 1
}

if (-not $WhatIf) {
    # Parse deployment outputs
    $deployment = $result | ConvertFrom-Json
    $outputs = $deployment.properties.outputs

    Write-Host "`n" -NoNewline
    Write-Success "Deployment completed successfully!"
    
    Write-Host @"

================================================================================
  Deployment Outputs
================================================================================
  App Service ID:         $($outputs.appServiceId.value)
  App Service Name:       $($outputs.appServiceName.value)
  App Service Hostname:   $($outputs.appServiceHostName.value)
  ACR Login Server:       $($outputs.containerRegistryLoginServer.value)
================================================================================

"@ -ForegroundColor Green

    # Set GitHub Actions outputs if running in CI
    if ($env:GITHUB_OUTPUT) {
        Write-Step "Setting GitHub Actions outputs..."
        
        "resourceGroup=$ResourceGroup" | Out-File -FilePath $env:GITHUB_OUTPUT -Append
        "appServiceName=$($outputs.appServiceName.value)" | Out-File -FilePath $env:GITHUB_OUTPUT -Append
        "appServiceHostName=$($outputs.appServiceHostName.value)" | Out-File -FilePath $env:GITHUB_OUTPUT -Append
        "acrName=$($outputs.containerRegistryNameOutput.value)" | Out-File -FilePath $env:GITHUB_OUTPUT -Append
        "acrLoginServer=$($outputs.containerRegistryLoginServer.value)" | Out-File -FilePath $env:GITHUB_OUTPUT -Append
        "appInsightsConnectionString=$($outputs.appInsightsConnectionString.value)" | Out-File -FilePath $env:GITHUB_OUTPUT -Append
        
        Write-Success "GitHub Actions outputs set"
    }
}
else {
    Write-Host $result
    Write-Info "What-If analysis complete. No changes were made."
}

Write-Host "`nDone!`n" -ForegroundColor Cyan