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
    acrPullPrincipalIds: []
    acrPushPrincipalIds: !empty(servicePrincipalObjectId) ? [servicePrincipalObjectId] : []
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

// Grant AcrPull to App Service Managed Identity, AcrPush to Service Principal
module acrRoleAssignments 'modules/containerRegistry.bicep' = if (createContainerRegistry) {
  name: 'acr-roles-${environment}'
  params: {
    containerRegistryName: containerRegistryName
    location: location
    sku: containerRegistrySku
    environment: environment
    tags: tags
    acrPullPrincipalIds: [
      appServiceModule.outputs.managedIdentityPrincipalId
      // Include slot identity if a slot was created (prod always has pre-production, staging has PR slots)
      (environment == 'prod' || !empty(slotName)) ? appServiceModule.outputs.slotManagedIdentityPrincipalId : ''
    ]
    acrPushPrincipalIds: !empty(servicePrincipalObjectId) ? [servicePrincipalObjectId] : []
  }
  dependsOn: [
    containerRegistryModule
    appServiceModule
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
