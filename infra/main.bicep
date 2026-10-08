// Main Bicep Template for SSW Rules Infrastructure
// Deploys App Service, Application Insights, Container Registry, and The Rulekeeper's database and models

targetScope = 'resourceGroup'

// ============================================================================
// PARAMETERS
// ============================================================================

@description('Environment name used for resource naming (staging/prod)')
@allowed([
  'staging'
  'prod'
])
param environment string

@description('Docker image tag pushed by the build pipeline (e.g., staging, production). Defaults to environment if not specified.')
param imageTag string = environment

@description('Location for all resources')
param location string = resourceGroup().location

@description('Name of the App Service')
param appServiceName string

@description('Name of the Application Insights resource')
param appInsightsName string

@description('Name of the Container Registry (must be globally unique, alphanumeric only)')
param containerRegistryName string

@description('Name of the App Service Plan')
param appServicePlanName string

@description('Resource Group containing the App Service Plan (only used when referencing existing plan)')
param appServicePlanResourceGroup string

@description('SKU for the App Service Plan (only used when creating new plan for production)')
@allowed([
  'B1'
  'B2'
  'B3'
  'P0v3'
  'P1v3'
])
param appServicePlanSku string = 'P0v3'

@description('Service Principal Object ID for granting AcrPush role (for GitHub Actions)')
param servicePrincipalObjectId string = ''

@description('Name of the Log Analytics Workspace')
param logAnalyticsWorkspaceName string

@description('SKU for Container Registry')
@allowed([
  'Basic'
  'Standard'
  'Premium'
])
param containerRegistrySku string = 'Basic'

@description('Tags to apply to all resources')
param tags object = {
  project: 'SSW.Rules'
  managedBy: 'Bicep'
}

@description('Optional: Name of the deployment slot (e.g., pr-123). If empty, no slot is created.')
param slotName string = ''

// ----------------------------------------------------------------------------
// The Rulekeeper (Rules Chat)
// ----------------------------------------------------------------------------

@description('Application (client) ID of the deployment pipeline\'s service principal, which administers the Rules Chat SQL server')
param rulesChatSqlAdminClientId string

@description('Name the Rules Chat SQL server shows for its administrator')
param rulesChatSqlAdminName string = 'SSW.Rules deployment pipeline'

@description('Name of the user-assigned managed identity the site uses for the Rules Chat database and models')
param rulesChatIdentityName string

@description('Name of the Rules Chat SQL logical server (globally unique)')
param rulesChatSqlServerName string

@description('Name of the Rules Chat database')
param rulesChatDatabaseName string = 'RulesChat'

@description('Rules Chat database SKU. Defaults to serverless with auto-pause for staging and a fixed-price S1 for production.')
param rulesChatDatabaseSku object = environment == 'prod'
  ? {
      name: 'S1'
      tier: 'Standard'
    }
  : {
      name: 'GP_S_Gen5_1'
      tier: 'GeneralPurpose'
      family: 'Gen5'
      capacity: 1
    }

@description('Name of the Rules Chat Microsoft Foundry resource (globally unique)')
param rulesChatFoundryName string

@description('Chat model deployment. Capacity is in thousands of tokens per minute.')
param rulesChatChatModel object = {
  name: 'gpt-6-luna'
  version: '2026-09-22'
  deploymentType: 'GlobalStandard'
  capacity: 100
}

@description('Name of the Container Apps environment that runs the Rules Chat index job')
param rulesChatContainerAppsEnvironmentName string

@description('Name of the Container Apps job that indexes the rules (32 characters at most)')
param rulesChatIndexJobName string

@description('SSW.Rules.Content branch the index job reads, matching the content this environment shows')
param rulesChatContentBranch string = 'main'

@description('Optional: email address for index job failure and staleness alerts. No alerts are created when empty.')
param rulesChatAlertEmail string = ''

@description('Embedding model deployment. Capacity is in thousands of tokens per minute; re-indexing every rule is the peak.')
param rulesChatEmbeddingModel object = {
  name: 'text-embedding-3-large'
  version: '1'
  deploymentType: 'GlobalStandard'
  capacity: 150
}

// ============================================================================
// VARIABLES - Well-known Azure Role Definition IDs
// ============================================================================

// https://learn.microsoft.com/en-us/azure/role-based-access-control/built-in-roles/containers
var acrPullRoleId = '7f951dda-4ed3-4680-a7ca-43fe172d538d'
var acrPushRoleId = '8311e382-0749-4cb8-b61a-304f252e45ec'

// ============================================================================
// APP SERVICE PLAN
// ============================================================================

// For staging: Reference existing shared App Service Plan in another resource group
// For production: Create a new dedicated App Service Plan
resource existingAppServicePlan 'Microsoft.Web/serverfarms@2025-03-01' existing = if (environment == 'staging') {
  name: appServicePlanName
  scope: resourceGroup(appServicePlanResourceGroup)
}

// Create App Service Plan for production
module appServicePlanModule 'modules/appServicePlan.bicep' = if (environment == 'prod') {
  name: 'appServicePlan-${environment}'
  params: {
    appServicePlanName: appServicePlanName
    location: location
    environment: environment
    skuName: appServicePlanSku
    tags: tags
  }
}

// ============================================================================
// MODULES
// ============================================================================

// Log Analytics Workspace
module logAnalyticsModule 'modules/logAnalytics.bicep' = {
  name: 'logAnalytics-${environment}'
  params: {
    logAnalyticsWorkspaceName: logAnalyticsWorkspaceName
    location: location
    environment: environment
    tags: tags
  }
}

// Application Insights
module appInsightsModule 'modules/appInsights.bicep' = {
  name: 'appInsights-${environment}'
  params: {
    appInsightsName: appInsightsName
    logAnalyticsWorkspaceId: logAnalyticsModule.outputs.logAnalyticsWorkspaceId
    location: location
    environment: environment
    tags: tags
  }
}

// Container Registry
module containerRegistryModule 'modules/containerRegistry.bicep' = {
  name: 'containerRegistry-${environment}'
  params: {
    containerRegistryName: containerRegistryName
    location: location
    sku: containerRegistrySku
    environment: environment
    tags: tags
  }
}

// Identity the site (including every slot) uses for the Rules Chat database and models
resource rulesChatIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: rulesChatIdentityName
  location: location
  tags: union(tags, {
    environment: environment
  })
}

// PR slot deploys share staging's database and models but leave them alone: two PR deploys can run at once, and a
// PR branch must not be able to change what every other PR and staging use.
var deploysSharedRulesChat = empty(slotName)

module rulesChatSqlModule 'modules/rulesChatSql.bicep' = if (deploysSharedRulesChat) {
  name: 'rulesChatSql-${environment}'
  params: {
    sqlServerName: rulesChatSqlServerName
    databaseName: rulesChatDatabaseName
    location: location
    environment: environment
    adminName: rulesChatSqlAdminName
    adminClientId: rulesChatSqlAdminClientId
    databaseSku: rulesChatDatabaseSku
    tags: tags
  }
}

module rulesChatFoundryModule 'modules/rulesChatFoundry.bicep' = if (deploysSharedRulesChat) {
  name: 'rulesChatFoundry-${environment}'
  params: {
    foundryName: rulesChatFoundryName
    location: location
    environment: environment
    chatModel: rulesChatChatModel
    embeddingModel: rulesChatEmbeddingModel
    callerPrincipalId: rulesChatIdentity.properties.principalId
    pipelinePrincipalId: servicePrincipalObjectId
    tags: tags
  }
}

// The job pulls its image from ACR as the Rules Chat identity.
module acrPullRulesChatIdentity 'modules/acrRoleAssignment.bicep' = if (deploysSharedRulesChat) {
  name: 'acr-pull-rules-chat-${environment}'
  params: {
    containerRegistryName: containerRegistryName
    roleDefinitionId: acrPullRoleId
    principalId: rulesChatIdentity.properties.principalId
  }
  dependsOn: [
    containerRegistryModule
  ]
}

module rulesChatIndexJobModule 'modules/rulesChatIndexJob.bicep' = if (deploysSharedRulesChat) {
  name: 'rulesChatIndexJob-${environment}'
  params: {
    containerAppsEnvironmentName: rulesChatContainerAppsEnvironmentName
    jobName: rulesChatIndexJobName
    location: location
    environment: environment
    logAnalyticsWorkspaceName: logAnalyticsWorkspaceName
    containerRegistryLoginServer: containerRegistryModule.outputs.loginServer
    // Pushed by the deploy-infrastructure workflow before this template runs.
    image: '${containerRegistryModule.outputs.loginServer}/rules-chat-index:${imageTag}'
    identityId: rulesChatIdentity.id
    identityClientId: rulesChatIdentity.properties.clientId
    sqlServerFqdn: '${rulesChatSqlServerName}${az.environment().suffixes.sqlServerHostname}'
    databaseName: rulesChatDatabaseName
    aiEndpoint: 'https://${rulesChatFoundryName}.openai.azure.com/openai/v1'
    embeddingModel: rulesChatEmbeddingModel.name
    contentBranch: rulesChatContentBranch
    alertEmail: rulesChatAlertEmail
    tags: tags
  }
  dependsOn: [
    logAnalyticsModule
    acrPullRulesChatIdentity
  ]
}

// App Service with System Assigned Managed Identity
module appServiceModule 'modules/appService.bicep' = {
  name: 'appService-${environment}'
  params: {
    appServiceName: appServiceName
    location: location
    // Use existing plan for staging, newly created plan for production
    appServicePlanId: environment == 'staging' ? existingAppServicePlan.id : appServicePlanModule.outputs.appServicePlanId
    containerRegistryName: containerRegistryName
    environment: environment
    imageTag: imageTag
    tags: tags
    slotName: slotName
    userAssignedIdentityId: rulesChatIdentity.id
  }
  dependsOn: [
    containerRegistryModule
  ]
}

// ============================================================================
// ACR ROLE ASSIGNMENTS (after App Service is created)
// ============================================================================

// AcrPull for App Service Managed Identity
module acrPullAppService 'modules/acrRoleAssignment.bicep' = {
  name: 'acr-pull-appservice-${environment}'
  params: {
    containerRegistryName: containerRegistryName
    roleDefinitionId: acrPullRoleId
    principalId: appServiceModule.outputs.managedIdentityPrincipalId
  }
  dependsOn: [
    containerRegistryModule
  ]
}

// AcrPull for Deployment Slot Managed Identity (if slot exists)
module acrPullSlot 'modules/acrRoleAssignment.bicep' = if (environment == 'prod' || !empty(slotName)) {
  name: 'acr-pull-slot-${environment}'
  params: {
    containerRegistryName: containerRegistryName
    roleDefinitionId: acrPullRoleId
    principalId: appServiceModule.outputs.slotManagedIdentityPrincipalId
  }
  dependsOn: [
    containerRegistryModule
  ]
}

// AcrPush for CI/CD Service Principal (if provided)
module acrPushServicePrincipal 'modules/acrRoleAssignment.bicep' = if (!empty(servicePrincipalObjectId)) {
  name: 'acr-push-cicd-${environment}'
  params: {
    containerRegistryName: containerRegistryName
    roleDefinitionId: acrPushRoleId
    principalId: servicePrincipalObjectId
  }
  dependsOn: [
    containerRegistryModule
  ]
}

// ============================================================================
// OUTPUTS
// ============================================================================

@description('App Service resource ID')
output appServiceId string = appServiceModule.outputs.appServiceId

@description('App Service name')
output appServiceName string = appServiceModule.outputs.appServiceName

@description('App Service default hostname')
output appServiceHostName string = appServiceModule.outputs.appServiceHostName

@description('App Service System Assigned Managed Identity Principal ID')
output appServiceIdentityPrincipalId string = appServiceModule.outputs.managedIdentityPrincipalId

@description('Application Insights connection string')
output appInsightsConnectionString string = appInsightsModule.outputs.connectionString

@description('Application Insights instrumentation key')
output appInsightsInstrumentationKey string = appInsightsModule.outputs.instrumentationKey

@description('Log Analytics Workspace resource ID')
output logAnalyticsWorkspaceId string = logAnalyticsModule.outputs.logAnalyticsWorkspaceId

@description('Container Registry login server')
output containerRegistryLoginServer string = containerRegistryModule.outputs.loginServer

@description('Container Registry name')
output containerRegistryNameOutput string = containerRegistryName

@description('Deployment slot name (if created)')
output slotName string = appServiceModule.outputs.slotName

@description('Deployment slot hostname (if created)')
output slotHostName string = appServiceModule.outputs.slotHostName

@description('Client ID of the Rules Chat managed identity')
output rulesChatIdentityClientId string = rulesChatIdentity.properties.clientId

// Built from the names, so slot deploys report the same values without touching the shared resources.
@description('Rules Chat SQL server hostname')
output rulesChatSqlServerFqdn string = '${rulesChatSqlServerName}${az.environment().suffixes.sqlServerHostname}'

@description('Rules Chat database name')
output rulesChatDatabaseName string = rulesChatDatabaseName

@description('Rules Chat OpenAI-compatible model endpoint')
output rulesChatAiEndpoint string = 'https://${rulesChatFoundryName}.openai.azure.com/openai/v1'

@description('Rules Chat chat model deployment name')
output rulesChatChatModel string = rulesChatChatModel.name

@description('Rules Chat embedding model deployment name')
output rulesChatEmbeddingModel string = rulesChatEmbeddingModel.name
