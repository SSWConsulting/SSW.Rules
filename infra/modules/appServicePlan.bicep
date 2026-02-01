// App Service Plan Module
// Creates a Linux App Service Plan for production environments

@description('Name of the App Service Plan')
param appServicePlanName string

@description('Location for the App Service Plan')
param location string = resourceGroup().location

@description('Environment name (staging/prod)')
param environment string

@description('SKU name for the App Service Plan')
@allowed([
  'B1'
  'B2'
  'B3'
  'S1'
  'S2'
  'S3'
  'P0v3'
  'P1v2'
  'P2v2'
  'P3v2'
  'P1v3'
  'P2v3'
  'P3v3'
])
param skuName string = 'P0v3'

@description('Tags to apply to the resource')
param tags object = {}

// ============================================================================
// RESOURCES
// ============================================================================

resource appServicePlan 'Microsoft.Web/serverfarms@2025-03-01' = {
  name: appServicePlanName
  location: location
  tags: union(tags, {
    environment: environment
  })
  kind: 'linux'
  sku: {
    name: skuName
  }
  properties: {
    reserved: true // Required for Linux
  }
}

// ============================================================================
// OUTPUTS
// ============================================================================

@description('The resource ID of the App Service Plan')
output appServicePlanId string = appServicePlan.id

@description('The name of the App Service Plan')
output appServicePlanName string = appServicePlan.name
