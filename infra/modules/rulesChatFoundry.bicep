// Rules Chat Foundry Module
// Deploys a Microsoft Foundry (AI Services) resource with The Rulekeeper's chat and embedding models

@description('Name of the Foundry resource; also its custom subdomain, so it must be globally unique')
param foundryName string

@description('Location for the resource')
param location string = resourceGroup().location

@description('Environment name for tagging (staging/prod)')
param environment string

@description('Chat model deployment')
param chatModel object

@description('Embedding model deployment')
param embeddingModel object

@description('Principal ID of the managed identity that calls the models')
param callerPrincipalId string

@description('Tags to apply to the resource')
param tags object = {}

// https://learn.microsoft.com/en-us/azure/role-based-access-control/built-in-roles/ai-machine-learning
var cognitiveServicesOpenAIUserRoleId = '5e0bd9bd-7b93-4f28-af87-19fc36ad61bd'

// ============================================================================
// RESOURCES
// ============================================================================

resource foundry 'Microsoft.CognitiveServices/accounts@2025-06-01' = {
  name: foundryName
  location: location
  tags: union(tags, {
    environment: environment
  })
  kind: 'AIServices'
  sku: {
    name: 'S0'
  }
  properties: {
    customSubDomainName: foundryName
    publicNetworkAccess: 'Enabled'
    // Callers sign in with a managed identity, so there are no API keys to leak or rotate.
    disableLocalAuth: true
  }
}

resource chatDeployment 'Microsoft.CognitiveServices/accounts/deployments@2025-06-01' = {
  parent: foundry
  name: chatModel.name
  sku: {
    name: chatModel.deploymentType
    capacity: chatModel.capacity
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: chatModel.name
      version: chatModel.version
    }
  }
}

// A resource accepts one deployment change at a time, so the deployments run one after the other.
resource embeddingDeployment 'Microsoft.CognitiveServices/accounts/deployments@2025-06-01' = {
  parent: foundry
  name: embeddingModel.name
  sku: {
    name: embeddingModel.deploymentType
    capacity: embeddingModel.capacity
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: embeddingModel.name
      version: embeddingModel.version
    }
  }
  dependsOn: [
    chatDeployment
  ]
}

resource callerRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(foundry.id, callerPrincipalId, cognitiveServicesOpenAIUserRoleId)
  scope: foundry
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', cognitiveServicesOpenAIUserRoleId)
    principalId: callerPrincipalId
    principalType: 'ServicePrincipal'
  }
}

// ============================================================================
// OUTPUTS
// ============================================================================

@description('OpenAI-compatible endpoint (v1 API) of the Foundry resource')
output openAiEndpoint string = 'https://${foundry.properties.customSubDomainName}.openai.azure.com/openai/v1'

@description('Name of the chat model deployment')
output chatDeploymentName string = chatDeployment.name

@description('Name of the embedding model deployment')
output embeddingDeploymentName string = embeddingDeployment.name
