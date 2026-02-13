// App Service Module
// Deploys a Linux container-based App Service with System-assigned Managed Identity

@description('Name of the App Service')
param appServiceName string

@description('Location for the App Service')
param location string = resourceGroup().location

@description('Resource ID of the existing App Service Plan')
param appServicePlanId string

@description('Name of the Container Registry (without .azurecr.io)')
param containerRegistryName string

@description('Application Insights Connection String')
param appInsightsConnectionString string = ''

@description('Environment name for resource naming (staging/prod)')
param environment string

@description('Docker image tag pushed by the build pipeline (e.g., staging, production). Defaults to environment if not specified.')
param imageTag string = environment

@description('Tags to apply to the resource')
param tags object = {}

@description('Optional: Name of the deployment slot (e.g., pr-123). If empty, no slot is created.')
param slotName string = ''

// ============================================================================
// VARIABLES
// ============================================================================

// Determine the effective slot name:
// - For prod: always 'pre-production' (for blue-green swap deployments)
// - For staging: use provided slotName (for PR deployments), or empty for no slot
var effectiveSlotName = environment == 'prod' ? 'pre-production' : slotName

// Determine the Docker image tag for the slot:
// - For prod pre-production: use imageTag (same as main, for swap deployments)
// - For staging PR slots: use the slotName as the tag
var slotImageTag = environment == 'prod' ? imageTag : slotName

// Shared app settings used by both the main App Service and deployment slots
var baseAppSettings = [
  {
    name: 'WEBSITES_ENABLE_APP_SERVICE_STORAGE'
    value: 'false'
  }
  {
    name: 'DOCKER_REGISTRY_SERVER_URL'
    value: 'https://${containerRegistryName}.azurecr.io'
  }
  {
    name: 'WEBSITES_PORT'
    value: '3000'
  }
  {
    name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
    value: appInsightsConnectionString
  }
]

// Shared site configuration properties
var baseSiteConfig = {
  acrUseManagedIdentityCreds: true
  alwaysOn: true
  ftpsState: 'Disabled'
  minTlsVersion: '1.2'
  http20Enabled: true
  appSettings: baseAppSettings
}

// ============================================================================
// RESOURCES
// ============================================================================

// App Service with Linux container configuration
resource appService 'Microsoft.Web/sites@2025-03-01' = {
  name: appServiceName
  location: location
  tags: union(tags, {
    environment: environment
  })
  kind: 'app,linux,container'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlanId
    httpsOnly: true
    clientAffinityEnabled: false
    siteConfig: union(baseSiteConfig, {
      linuxFxVersion: 'DOCKER|${containerRegistryName}.azurecr.io/ssw-rules:${imageTag}'
    })
  }
}

// Deployment slot:
// - For prod: always created as 'pre-production' for blue-green deployments
// - For staging: created only when slotName is provided (for PR deployments)
resource deploymentSlot 'Microsoft.Web/sites/slots@2025-03-01' = if (!empty(effectiveSlotName)) {
  parent: appService
  name: effectiveSlotName
  location: location
  tags: union(tags, {
    environment: '${environment}-${effectiveSlotName}'
  })
  kind: 'app,linux,container'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlanId
    httpsOnly: true
    clientAffinityEnabled: false
    siteConfig: union(baseSiteConfig, {
      // For prod: uses environment tag (same as main app, ready for swap)
      // For staging PR slots: uses slotName as the tag (e.g., ssw-rules:pr-123)
      linuxFxVersion: 'DOCKER|${containerRegistryName}.azurecr.io/ssw-rules:${slotImageTag}'
    })
  }
}

// ============================================================================
// OUTPUTS
// ============================================================================

@description('The resource ID of the App Service')
output appServiceId string = appService.id

@description('The name of the App Service')
output appServiceName string = appService.name

@description('The default hostname of the App Service')
output appServiceHostName string = appService.properties.defaultHostName

@description('The principal ID of the System-assigned Managed Identity')
output managedIdentityPrincipalId string = appService.identity.principalId

@description('The principal ID of the deployment slot Managed Identity (if created)')
output slotManagedIdentityPrincipalId string = !empty(effectiveSlotName) ? deploymentSlot.identity.principalId : ''

@description('The name of the deployment slot (if created)')
output slotName string = effectiveSlotName

@description('The hostname of the deployment slot (if created)')
output slotHostName string = !empty(effectiveSlotName) ? deploymentSlot.properties.defaultHostName : ''
