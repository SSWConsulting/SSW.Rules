<#
.SYNOPSIS
    Deploys SSW Rules infrastructure to Azure using Bicep templates.

.DESCRIPTION
    This script deploys Azure resources using a consistent naming pattern:
    - app-{project}-{env}     (App Service)
    - appi-{project}-{env}    (Application Insights)
    - acr{project}{env}       (Container Registry - no hyphens allowed)
    - rg-{project}-{env}      (Resource Group)

.PARAMETER Environment
    The target environment (staging or prod)

.PARAMETER ServicePrincipalObjectId
    Object ID of the Service Principal to grant AcrPush role (for GitHub Actions)

.PARAMETER WhatIf
    Show what would be deployed without actually deploying

.EXAMPLE
    ./deploy.ps1 -Environment staging

.EXAMPLE
    ./deploy.ps1 -Environment staging -ServicePrincipalObjectId "12345678-1234-1234-1234-123456789012"
    
.EXAMPLE
    ./deploy.ps1 -Environment prod -WhatIf
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('staging', 'production')]
    [string]$Environment,

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

# All resource names derived from project + environment
$ResourceGroup = "rg-$ProjectName-$Environment"
$AppServiceName = "app-$ProjectName-$Environment"
$AppInsightsName = "appi-$ProjectName-$Environment"
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

# Check for existing resources
Write-Step "Checking for existing resources..."

$createAppInsights = $true
$createContainerRegistry = $true
$existingAppInsightsConnectionString = ''

# Check if App Insights exists
if (Test-ResourceExists -ResourceType 'Microsoft.Insights/components' -ResourceName $AppInsightsName -ResourceGroup $ResourceGroup) {
    Write-Info "Application Insights '$AppInsightsName' already exists - will skip creation"
    $createAppInsights = $false
    $appInsightsInfo = az monitor app-insights component show --app $AppInsightsName --resource-group $ResourceGroup 2>&1 | ConvertFrom-Json
    $existingAppInsightsConnectionString = $appInsightsInfo.connectionString
}
else {
    Write-Info "Application Insights '$AppInsightsName' - will create"
}

# Check if Container Registry exists
if (Test-ResourceExists -ResourceType 'Microsoft.ContainerRegistry/registries' -ResourceName $ContainerRegistryName -ResourceGroup $ResourceGroup) {
    Write-Info "Container Registry '$ContainerRegistryName' already exists - will skip creation"
    $createContainerRegistry = $false
}
else {
    Write-Info "Container Registry '$ContainerRegistryName' - will create"
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
    containerRegistryName = $ContainerRegistryName
    appServicePlanName = $AppServicePlanName
    appServicePlanResourceGroup = $AppServicePlanResourceGroup
    createAppInsights = $createAppInsights
    createContainerRegistry = $createContainerRegistry
}

if ($ServicePrincipalObjectId) {
    $deploymentParams.servicePrincipalObjectId = $ServicePrincipalObjectId
}

if (-not $createAppInsights -and $existingAppInsightsConnectionString) {
    $deploymentParams.existingAppInsightsConnectionString = $existingAppInsightsConnectionString
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
  2. App Service: $AppServiceName
  3. Application Insights: $(if ($createAppInsights) { $AppInsightsName } else { 'SKIPPED (already exists)' })
  4. Container Registry: $(if ($createContainerRegistry) { $ContainerRegistryName } else { 'SKIPPED (already exists)' })
  
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
    '--parameters', "containerRegistryName=$ContainerRegistryName"
    '--parameters', "appServicePlanName=$AppServicePlanName"
    '--parameters', "appServicePlanResourceGroup=$AppServicePlanResourceGroup"
    '--parameters', "createAppInsights=$($createAppInsights.ToString().ToLower())"
    '--parameters', "createContainerRegistry=$($createContainerRegistry.ToString().ToLower())"
)

if ($ServicePrincipalObjectId) {
    $azArgs += '--parameters', "servicePrincipalObjectId=$ServicePrincipalObjectId"
}

if (-not $createAppInsights -and $existingAppInsightsConnectionString) {
    $azArgs += '--parameters', "existingAppInsightsConnectionString=$existingAppInsightsConnectionString"
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
  Managed Identity ID:    $($outputs.managedIdentityPrincipalId.value)
  ACR Login Server:       $($outputs.containerRegistryLoginServer.value)
================================================================================

"@ -ForegroundColor Green

    # Set GitHub Actions outputs if running in CI
    if ($env:GITHUB_OUTPUT) {
        Write-Step "Setting GitHub Actions outputs..."
        
        "appServiceName=$($outputs.appServiceName.value)" | Out-File -FilePath $env:GITHUB_OUTPUT -Append
        "appServiceHostName=$($outputs.appServiceHostName.value)" | Out-File -FilePath $env:GITHUB_OUTPUT -Append
        "managedIdentityPrincipalId=$($outputs.managedIdentityPrincipalId.value)" | Out-File -FilePath $env:GITHUB_OUTPUT -Append
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
