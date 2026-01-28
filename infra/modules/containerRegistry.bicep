// Container Registry Module
// Creates Azure Container Registry with managed identity access

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
param adminUserEnabled bool = true

@description('Principal IDs to grant AcrPull role (for App Service to pull images)')
param acrPullPrincipalIds array = []

@description('Principal IDs to grant AcrPush role (for GitHub Actions/Service Principal to push images)')
param acrPushPrincipalIds array = []

@description('Environment name (staging/prod)')
param environment string

@description('Tags to apply to the resource')
param tags object = {}

// Container Registry
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
    policies: {
      quarantinePolicy: {
        status: 'disabled'
      }
      trustPolicy: {
        type: 'Notary'
        status: 'disabled'
      }
      retentionPolicy: {
        days: 7
        status: 'enabled'
      }
    }
    encryption: {
      status: 'disabled'
    }
    dataEndpointEnabled: false
    publicNetworkAccess: 'Enabled'
    networkRuleBypassOptions: 'AzureServices'
    zoneRedundancy: 'Disabled'
  }
}

// Role definitions
var acrPullRoleId = '7f951dda-4ed3-4680-a7ca-43fe172d538d'  // AcrPull
var acrPushRoleId = '8311e382-0749-4cb8-b61a-304f252e45ec'  // AcrPush

// AcrPull role assignments (for App Service to pull images)
resource acrPullRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for (principalId, i) in acrPullPrincipalIds: if (!empty(principalId)) {
  name: guid(containerRegistry.id, principalId, acrPullRoleId)
  scope: containerRegistry
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPullRoleId)
    principalId: principalId
    principalType: 'ServicePrincipal'
  }
}]

// AcrPush role assignments (for GitHub Actions/Service Principal to push images)
resource acrPushRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for (principalId, i) in acrPushPrincipalIds: if (!empty(principalId)) {
  name: guid(containerRegistry.id, principalId, acrPushRoleId)
  scope: containerRegistry
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPushRoleId)
    principalId: principalId
    principalType: 'ServicePrincipal'
  }
}]

@description('The resource ID of the Container Registry')
output containerRegistryId string = containerRegistry.id

@description('The name of the Container Registry')
output containerRegistryName string = containerRegistry.name

@description('The login server URL of the Container Registry')
output loginServer string = containerRegistry.properties.loginServer

@description('The admin username (if admin user is enabled)')
output adminUsername string = adminUserEnabled ? containerRegistry.listCredentials().username : ''
