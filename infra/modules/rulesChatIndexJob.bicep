// Rules Chat Index Job Module
// Deploys a Container Apps environment and a job that indexes changed rules every hour and whenever it's started, plus
// optional email alerts when a run fails or the index hasn't updated for two days

@description('Name of the Container Apps environment')
param containerAppsEnvironmentName string

@description('Name of the Container Apps job (32 characters at most)')
@maxLength(32)
param jobName string

@description('Location for the resources')
param location string = resourceGroup().location

@description('Environment name for tagging (staging/prod)')
param environment string

@description('Name of the existing Log Analytics workspace that receives the job logs')
param logAnalyticsWorkspaceName string

@description('Login server of the container registry that holds the job image')
param containerRegistryLoginServer string

@description('Full image reference of the index job')
param image string

@description('Resource ID of the user-assigned managed identity the job runs as')
param identityId string

@description('Client ID of that identity, used by the job to sign in to SQL and Foundry')
param identityClientId string

@description('Hostname of the Rules Chat SQL server')
param sqlServerFqdn string

@description('Name of the Rules Chat database')
param databaseName string

@description('OpenAI-compatible endpoint of the Foundry resource')
param aiEndpoint string

@description('Name of the embedding model deployment')
param embeddingModel string

@description('SSW.Rules.Content branch this environment shows')
param contentBranch string

@description('When the job runs, as a cron expression in UTC. A run with no changed rules only compares hashes.')
param scheduleCron string = '0 * * * *'

@description('Optional: email address for failure and staleness alerts. No alerts are created when empty.')
param alertEmail string = ''

@description('Tags to apply to the resources')
param tags object = {}

// Printed by scripts/rules-chat/index-rules.mjs at the end of every run.
var successMarker = 'RULES_CHAT_INDEX_SUCCEEDED'
var failureMarker = 'RULES_CHAT_INDEX_FAILED'

// ============================================================================
// RESOURCES
// ============================================================================

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' existing = {
  name: logAnalyticsWorkspaceName
}

resource containerAppsEnvironment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: containerAppsEnvironmentName
  location: location
  tags: union(tags, {
    environment: environment
  })
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
  }
}

resource job 'Microsoft.App/jobs@2024-03-01' = {
  name: jobName
  location: location
  tags: union(tags, {
    environment: environment
  })
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${identityId}': {}
    }
  }
  properties: {
    environmentId: containerAppsEnvironment.id
    configuration: {
      // A schedule job can also be started by hand or from a workflow (az containerapp job start). A run that starts
      // while another is going waits for the lock in the index script.
      triggerType: 'Schedule'
      scheduleTriggerConfig: {
        cronExpression: scheduleCron
        parallelism: 1
        replicaCompletionCount: 1
      }
      replicaTimeout: 7200
      replicaRetryLimit: 0
      registries: [
        {
          server: containerRegistryLoginServer
          identity: identityId
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'rules-chat-index'
          image: image
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            { name: 'RULES_CONTENT_BRANCH', value: contentBranch }
            { name: 'RULES_CHAT_SQL_SERVER', value: sqlServerFqdn }
            { name: 'RULES_CHAT_SQL_DATABASE', value: databaseName }
            { name: 'RULES_CHAT_IDENTITY_CLIENT_ID', value: identityClientId }
            { name: 'RULES_CHAT_AI_BASE_URL', value: aiEndpoint }
            { name: 'RULES_CHAT_EMBEDDING_MODEL', value: embeddingModel }
            { name: 'RULES_CHAT_EMBEDDING_DIMENSIONS', value: '1024' }
          ]
        }
      ]
    }
  }
}

resource alertActionGroup 'Microsoft.Insights/actionGroups@2023-01-01' = if (!empty(alertEmail)) {
  name: 'ag-${jobName}'
  location: 'global'
  tags: tags
  properties: {
    groupShortName: 'rulesindex'
    enabled: true
    emailReceivers: [
      {
        name: 'Rules Chat index'
        emailAddress: alertEmail
        useCommonAlertSchema: true
      }
    ]
  }
}

// The log table only exists after the job first writes to it, so the queries can't be validated at deploy time.
resource failedRunAlert 'Microsoft.Insights/scheduledQueryRules@2023-12-01' = if (!empty(alertEmail)) {
  name: 'alert-${jobName}-failed'
  location: location
  tags: tags
  properties: {
    displayName: 'Rules Chat index run failed (${environment})'
    description: 'A run of ${jobName} logged ${failureMarker}. Its logs in Log Analytics say why.'
    severity: 2
    enabled: true
    scopes: [
      logAnalytics.id
    ]
    evaluationFrequency: 'PT1H'
    windowSize: 'PT1H'
    skipQueryValidation: true
    autoMitigate: true
    criteria: {
      allOf: [
        {
          query: 'ContainerAppConsoleLogs_CL | where Log_s has "${failureMarker}"'
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: 0
          failingPeriods: {
            numberOfEvaluationPeriods: 1
            minFailingPeriodsToAlert: 1
          }
        }
      ]
    }
    actions: {
      actionGroups: [
        alertActionGroup.id
      ]
    }
  }
}

resource staleIndexAlert 'Microsoft.Insights/scheduledQueryRules@2023-12-01' = if (!empty(alertEmail)) {
  name: 'alert-${jobName}-stale'
  location: location
  tags: tags
  properties: {
    displayName: 'Rules Chat index not updated for two days (${environment})'
    description: 'No run of ${jobName} logged ${successMarker} in the last two days.'
    severity: 2
    enabled: true
    scopes: [
      logAnalytics.id
    ]
    evaluationFrequency: 'PT6H'
    windowSize: 'P2D'
    skipQueryValidation: true
    autoMitigate: true
    criteria: {
      allOf: [
        {
          query: 'ContainerAppConsoleLogs_CL | where Log_s has "${successMarker}"'
          timeAggregation: 'Count'
          operator: 'LessThan'
          threshold: 1
          failingPeriods: {
            numberOfEvaluationPeriods: 1
            minFailingPeriodsToAlert: 1
          }
        }
      ]
    }
    actions: {
      actionGroups: [
        alertActionGroup.id
      ]
    }
  }
}
