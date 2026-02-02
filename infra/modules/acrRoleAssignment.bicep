// ACR Role Assignment Module
// Assigns a single role to a principal on a Container Registry

@description('Name of the existing Container Registry')
param containerRegistryName string

@description('The role definition ID (GUID) to assign')
param roleDefinitionId string

@description('The principal ID to assign the role to')
param principalId string

@description('The type of principal')
@allowed([
  'Device'
  'ForeignGroup'
  'Group'
  'ServicePrincipal'
  'User'
])
param principalType string = 'ServicePrincipal'

// ============================================================================
// EXISTING RESOURCES
// ============================================================================

resource containerRegistry 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = {
  name: containerRegistryName
}

// ============================================================================
// ROLE ASSIGNMENT
// ============================================================================

resource roleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(containerRegistry.id, principalId, roleDefinitionId)
  scope: containerRegistry
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleDefinitionId)
    principalId: principalId
    principalType: principalType
  }
}

// ============================================================================
// OUTPUTS
// ============================================================================

@description('The resource ID of the role assignment')
output roleAssignmentId string = roleAssignment.id
