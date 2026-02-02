// Log Analytics Workspace Module
// Creates a Log Analytics Workspace for Application Insights and other monitoring

@description('Name of the Log Analytics Workspace')
param logAnalyticsWorkspaceName string

@description('Location for the resources')
param location string = resourceGroup().location

@description('Environment name (staging/prod)')
param environment string

@description('Tags to apply to the resources')
param tags object = {}

@description('Log Analytics Workspace retention in days')
@minValue(30)
@maxValue(730)
param retentionInDays int = 30

// ============================================================================
// RESOURCES
// ============================================================================

resource logAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: logAnalyticsWorkspaceName
  location: location
  tags: union(tags, {
    environment: environment
  })
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: retentionInDays
    features: {
      enableLogAccessUsingOnlyResourcePermissions: true
    }
    workspaceCapping: {
      dailyQuotaGb: -1 // No daily cap
    }
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

// ============================================================================
// OUTPUTS
// ============================================================================

@description('The resource ID of the Log Analytics Workspace')
output logAnalyticsWorkspaceId string = logAnalyticsWorkspace.id

@description('The name of the Log Analytics Workspace')
output logAnalyticsWorkspaceName string = logAnalyticsWorkspace.name
