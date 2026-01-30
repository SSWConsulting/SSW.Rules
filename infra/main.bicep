// Main Bicep Template for SSW Rules Infrastructure
// Deploys App Service, Application Insights, and Container Registry

targetScope = 'resourceGroup'

// ============================================================================
// PARAMETERS
// ============================================================================

@description('Environment name')
@allowed([
  'staging'
  'prod'
])
param environment string

@description('Location for all resources')
param location string = resourceGroup().location

@description('Name of the App Service')
param appServiceName string

@description('Name of the Application Insights resource')
param appInsightsName string

@description('Name of the Container Registry (must be globally unique, alphanumeric only)')
param containerRegistryName string

@description('Name of the existing App Service Plan')
param appServicePlanName string

@description('Resource Group containing the existing App Service Plan')
param appServicePlanResourceGroup string

@description('Service Principal Object ID for granting AcrPush role (for GitHub Actions)')
param servicePrincipalObjectId string = ''

@description('Name of the Log Analytics Workspace')
param logAnalyticsWorkspaceName string

@description('Whether to create Application Insights (set to false if it already exists)')
param createAppInsights bool = true

@description('Whether to create Container Registry (set to false if it already exists)')
param createContainerRegistry bool = true

@description('Existing Application Insights connection string (if not creating new)')
param existingAppInsightsConnectionString string = ''

@description('SKU for Container Registry')
@allowed([
  'Basic'
  'Standard'
  'Premium'
])
param containerRegistrySku string = 'Basic'

@description('Tags to apply to all resources')
param tags object = {
  project: 'SSW.Rules'
  managedBy: 'Bicep'
}

@description('Optional: Name of the deployment slot (e.g., pr-123). If empty, no slot is created.')
param slotName string = ''

// ============================================================================
// VARIABLES - Well-known Azure Role Definition IDs
// ============================================================================

// https://learn.microsoft.com/en-us/azure/role-based-access-control/built-in-roles/containers
var acrPullRoleId = '7f951dda-4ed3-4680-a7ca-43fe172d538d'
var acrPushRoleId = '8311e382-0749-4cb8-b61a-304f252e45ec'

// ============================================================================
// EXISTING RESOURCES
// ============================================================================

// Reference to existing App Service Plan in another resource group
resource existingAppServicePlan 'Microsoft.Web/serverfarms@2025-03-01' existing = {
  name: appServicePlanName
  scope: resourceGroup(appServicePlanResourceGroup)
}

// ============================================================================
// MODULES
// ============================================================================

// Application Insights and Log Analytics Workspace (conditional)
module appInsightsModule 'modules/appInsights.bicep' = if (createAppInsights) {
  name: 'appInsights-${environment}'
  params: {
    appInsightsName: appInsightsName
    logAnalyticsWorkspaceName: logAnalyticsWorkspaceName
    location: location
    environment: environment
    tags: tags
  }
}

// Container Registry (conditional)
module containerRegistryModule 'modules/containerRegistry.bicep' = if (createContainerRegistry) {
  name: 'containerRegistry-${environment}'
  params: {
    containerRegistryName: containerRegistryName
    location: location
    sku: containerRegistrySku
    environment: environment
    tags: tags
  }
}

// App Service with System Assigned Managed Identity
module appServiceModule 'modules/appService.bicep' = {
  name: 'appService-${environment}'
  params: {
    appServiceName: appServiceName
    location: location
    appServicePlanId: existingAppServicePlan.id
    containerRegistryName: containerRegistryName
    appInsightsConnectionString: createAppInsights ? appInsightsModule.outputs.connectionString : existingAppInsightsConnectionString
    environment: environment
    tags: tags
    slotName: slotName
  }
  dependsOn: [
    appInsightsModule
    containerRegistryModule
  ]
}

// ============================================================================
// ACR ROLE ASSIGNMENTS (after App Service is created)
// ============================================================================

// AcrPull for App Service Managed Identity
module acrPullAppService 'modules/acrRoleAssignment.bicep' = if (createContainerRegistry) {
  name: 'acr-pull-appservice-${environment}'
  params: {
    containerRegistryName: containerRegistryName
    roleDefinitionId: acrPullRoleId
    principalId: appServiceModule.outputs.managedIdentityPrincipalId
  }
  dependsOn: [
    containerRegistryModule
  ]
}

// AcrPull for Deployment Slot Managed Identity (if slot exists)
module acrPullSlot 'modules/acrRoleAssignment.bicep' = if (createContainerRegistry && (environment == 'prod' || !empty(slotName))) {
  name: 'acr-pull-slot-${environment}'
  params: {
    containerRegistryName: containerRegistryName
    roleDefinitionId: acrPullRoleId
    principalId: appServiceModule.outputs.slotManagedIdentityPrincipalId
  }
  dependsOn: [
    containerRegistryModule
  ]
}

// AcrPush for CI/CD Service Principal (if provided)
module acrPushServicePrincipal 'modules/acrRoleAssignment.bicep' = if (createContainerRegistry && !empty(servicePrincipalObjectId)) {
  name: 'acr-push-cicd-${environment}'
  params: {
    containerRegistryName: containerRegistryName
    roleDefinitionId: acrPushRoleId
    principalId: servicePrincipalObjectId
  }
  dependsOn: [
    containerRegistryModule
  ]
}

// ============================================================================
// OUTPUTS
// ============================================================================

@description('App Service resource ID')
output appServiceId string = appServiceModule.outputs.appServiceId

@description('App Service name')
output appServiceName string = appServiceModule.outputs.appServiceName

@description('App Service default hostname')
output appServiceHostName string = appServiceModule.outputs.appServiceHostName

@description('App Service System Assigned Managed Identity Principal ID')
output appServiceIdentityPrincipalId string = appServiceModule.outputs.managedIdentityPrincipalId

@description('Application Insights connection string')
output appInsightsConnectionString string = createAppInsights ? appInsightsModule.outputs.connectionString : existingAppInsightsConnectionString

@description('Application Insights instrumentation key')
output appInsightsInstrumentationKey string = createAppInsights ? appInsightsModule.outputs.instrumentationKey : ''

@description('Log Analytics Workspace resource ID')
output logAnalyticsWorkspaceId string = createAppInsights ? appInsightsModule.outputs.logAnalyticsWorkspaceId : ''

@description('Container Registry login server')
output containerRegistryLoginServer string = createContainerRegistry ? containerRegistryModule.outputs.loginServer : '${containerRegistryName}.azurecr.io'

@description('Container Registry name')
output containerRegistryNameOutput string = containerRegistryName

@description('Deployment slot name (if created)')
output slotName string = appServiceModule.outputs.slotName

@description('Deployment slot hostname (if created)')
output slotHostName string = appServiceModule.outputs.slotHostName
