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
resource containerRegistry 'Microsoft.ContainerRegistry/registries@2025-11-01' = {
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
// BUILT-IN ROLE DEFINITIONS
// ============================================================================

// AcrPull - Pull artifacts from a container registry
// https://learn.microsoft.com/en-us/azure/role-based-access-control/built-in-roles/containers#acrpull
resource acrPullRole 'Microsoft.Authorization/roleDefinitions@2022-04-01' existing = {
  scope: subscription()
  name: '7f951dda-4ed3-4680-a7ca-43fe172d538d'
}

// AcrPush - Push artifacts to a container registry (includes pull permissions)
// https://learn.microsoft.com/en-us/azure/role-based-access-control/built-in-roles/containers#acrpush
resource acrPushRole 'Microsoft.Authorization/roleDefinitions@2022-04-01' existing = {
  scope: subscription()
  name: '8311e382-0749-4cb8-b61a-304f252e45ec'
}

// ============================================================================
// ROLE ASSIGNMENTS
// ============================================================================

// AcrPull role assignments (for App Service managed identities to pull images)
resource acrPullRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for (principalId, i) in acrPullPrincipalIds: if (!empty(principalId)) {
  name: guid(containerRegistry.id, principalId, acrPullRole.id)
  scope: containerRegistry
  properties: {
    roleDefinitionId: acrPullRole.id
    principalId: principalId
    principalType: 'ServicePrincipal'
  }
}]

// AcrPush role assignments (for CI/CD service principals to push images)
// Note: AcrPush includes pull permissions, so these principals don't need AcrPull
resource acrPushRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for (principalId, i) in acrPushPrincipalIds: if (!empty(principalId)) {
  name: guid(containerRegistry.id, principalId, acrPushRole.id)
  scope: containerRegistry
  properties: {
    roleDefinitionId: acrPushRole.id
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
