// Application Insights Module
// Creates Application Insights resource using existing Log Analytics Workspace

@description('Name of the Application Insights resource')
param appInsightsName string

@description('Location for the resources')
param location string = resourceGroup().location

@description('Environment name (staging/prod)')
param environment string

@description('Tags to apply to the resources')
param tags object = {}

// Existing shared Log Analytics Workspace
var logAnalyticsWorkspaceId = '/subscriptions/b8b18dcf-d83b-47e2-9886-00c2e983629e/resourcegroups/ssw.logs/providers/microsoft.operationalinsights/workspaces/defaultworkspace-b8b18dcf-d83b-47e2-9886-00c2e983629e-eau'

// Application Insights resource
resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  tags: union(tags, {
    environment: environment
  })
  kind: 'web'
  properties: {
    Application_Type: 'web'
    Flow_Type: 'Bluefield'
    Request_Source: 'rest'
    WorkspaceResourceId: logAnalyticsWorkspaceId
    IngestionMode: 'LogAnalytics'
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
    RetentionInDays: 90
  }
}

@description('The resource ID of the Application Insights')
output appInsightsId string = appInsights.id

@description('The name of the Application Insights')
output appInsightsName string = appInsights.name

@description('The connection string for Application Insights')
output connectionString string = appInsights.properties.ConnectionString

@description('The instrumentation key for Application Insights')
output instrumentationKey string = appInsights.properties.InstrumentationKey

@description('The resource ID of the Log Analytics Workspace')
output logAnalyticsWorkspaceId string = logAnalyticsWorkspaceId
