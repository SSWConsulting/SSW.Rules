// Application Insights Module
// Creates Application Insights resource using existing Log Analytics Workspace

@description('Name of the Application Insights resource')
param appInsightsName string

@description('Location for the resources')
param location string = resourceGroup().location

@description('Environment name (staging/prod)')
param environment string

@description('Resource ID of the Log Analytics Workspace to link to')
param logAnalyticsWorkspaceId string

@description('Tags to apply to the resources')
param tags object = {}

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
