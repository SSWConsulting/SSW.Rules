// Rules Chat SQL Module
// Deploys an Azure SQL logical server and database for The Rulekeeper's vector index and usage counts

@description('Name of the SQL logical server (globally unique)')
param sqlServerName string

@description('Name of the database')
param databaseName string

@description('Location for the resources')
param location string = resourceGroup().location

@description('Environment name for tagging (staging/prod)')
param environment string

@description('Name the server shows for its administrator')
param adminName string

@description('Application (client) ID of the service principal that administers the server')
param adminClientId string

@description('Database SKU. Serverless (GP_S_*) pauses when idle; the DTU tiers (S0, S1...) are a fixed price and never pause.')
param databaseSku object

@description('Minutes of inactivity before a serverless database pauses. Ignored by non-serverless SKUs.')
param autoPauseDelayMinutes int = 60

@description('Tags to apply to the resources')
param tags object = {}

var isServerless = startsWith(databaseSku.name, 'GP_S_')

// ============================================================================
// RESOURCES
// ============================================================================

resource sqlServer 'Microsoft.Sql/servers@2023-08-01' = {
  name: sqlServerName
  location: location
  tags: union(tags, {
    environment: environment
  })
  properties: {
    minimalTlsVersion: '1.2'
    publicNetworkAccess: 'Enabled'
    // Microsoft Entra sign-in only: no SQL logins or passwords to store or rotate.
    // The deployment pipeline is the administrator, so it can apply schema changes and grant access on every deploy.
    administrators: {
      administratorType: 'ActiveDirectory'
      azureADOnlyAuthentication: true
      login: adminName
      sid: adminClientId
      tenantId: subscription().tenantId
      principalType: 'Application'
    }
  }
}

// The App Service has no fixed outbound IP or VNet, so the server accepts connections from Azure services.
// Every connection still needs a Microsoft Entra identity that has a user in the database.
resource allowAzureServices 'Microsoft.Sql/servers/firewallRules@2023-08-01' = {
  parent: sqlServer
  name: 'AllowAllWindowsAzureIps'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

resource database 'Microsoft.Sql/servers/databases@2023-08-01' = {
  parent: sqlServer
  name: databaseName
  location: location
  tags: union(tags, {
    environment: environment
  })
  sku: databaseSku
  properties: union(
    {
      // The index can be rebuilt from the rules repository and usage counts are short-lived, so geo-redundant
      // backups add cost without benefit.
      requestedBackupStorageRedundancy: 'Local'
      zoneRedundant: false
    },
    isServerless
      ? {
          autoPauseDelay: autoPauseDelayMinutes
          minCapacity: json('0.5')
        }
      : {}
  )
}
