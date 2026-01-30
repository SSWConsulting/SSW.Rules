// Container Registry Module
// Creates Azure Container Registry

@description('Name of the Container Registry (must be globally unique, alphanumeric)')
param containerRegistryName string

@description('Location for the Container Registry')
param location string = resourceGroup().location

@description('SKU for the Container Registry')
@allowed([
  'Basic'
  'Standard'
  'Premium'
])
param sku string = 'Basic'

@description('Enable admin user for the Container Registry')
param adminUserEnabled bool = false

@description('Environment name (staging/prod)')
param environment string

@description('Tags to apply to the resource')
param tags object = {}

// ============================================================================
// RESOURCES
// ============================================================================

resource containerRegistry 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: containerRegistryName
  location: location
  tags: union(tags, {
    environment: environment
  })
  sku: {
    name: sku
  }
  properties: {
    adminUserEnabled: adminUserEnabled
    publicNetworkAccess: 'Enabled'
    networkRuleBypassOptions: 'AzureServices'
    zoneRedundancy: 'Disabled'
  }
}

// ============================================================================
// OUTPUTS
// ============================================================================

@description('The resource ID of the Container Registry')
output containerRegistryId string = containerRegistry.id

@description('The name of the Container Registry')
output containerRegistryName string = containerRegistry.name

@description('The login server URL of the Container Registry')
output loginServer string = containerRegistry.properties.loginServer
