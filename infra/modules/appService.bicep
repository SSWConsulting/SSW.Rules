// App Service Module
// Deploys a Linux container-based App Service with System-assigned Managed Identity

@description('Name of the App Service')
param appServiceName string

@description('Location for the App Service')
param location string = resourceGroup().location

@description('Resource ID of the existing App Service Plan')
param appServicePlanId string

@description('Name of the Container Registry (without .azurecr.io)')
param containerRegistryName string

@description('Application Insights Connection String')
param appInsightsConnectionString string = ''

@description('Environment name (staging/prod)')
param environment string

@description('Tags to apply to the resource')
param tags object = {}

// App Service with Linux container configuration
resource appService 'Microsoft.Web/sites@2023-12-01' = {
  name: appServiceName
  location: location
  tags: union(tags, {
    environment: environment
  })
  kind: 'app,linux,container'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlanId
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'DOCKER|${containerRegistryName}.azurecr.io/ssw-rules:${environment}'
      acrUseManagedIdentityCreds: true
      alwaysOn: true
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      http20Enabled: true
      appSettings: [
        {
          name: 'WEBSITES_ENABLE_APP_SERVICE_STORAGE'
          value: 'false'
        }
        {
          name: 'DOCKER_REGISTRY_SERVER_URL'
          value: 'https://${containerRegistryName}.azurecr.io'
        }
        {
          name: 'WEBSITES_PORT'
          value: '3000'
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsightsConnectionString
        }
      ]
    }
  }
}

// Pre-production deployment slot for prod environment
resource preProductionSlot 'Microsoft.Web/sites/slots@2023-12-01' = if (environment == 'prod') {
  parent: appService
  name: 'pre-production'
  location: location
  tags: union(tags, {
    environment: '${environment}-preprod'
  })
  kind: 'app,linux,container'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlanId
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'DOCKER|${containerRegistryName}.azurecr.io/ssw-rules:${environment}'
      acrUseManagedIdentityCreds: true
      alwaysOn: true
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      http20Enabled: true
      appSettings: [
        {
          name: 'WEBSITES_ENABLE_APP_SERVICE_STORAGE'
          value: 'false'
        }
        {
          name: 'DOCKER_REGISTRY_SERVER_URL'
          value: 'https://${containerRegistryName}.azurecr.io'
        }
        {
          name: 'WEBSITES_PORT'
          value: '3000'
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsightsConnectionString
        }
      ]
    }
  }
}

@description('The resource ID of the App Service')
output appServiceId string = appService.id

@description('The name of the App Service')
output appServiceName string = appService.name

@description('The default hostname of the App Service')
output appServiceHostName string = appService.properties.defaultHostName

@description('The principal ID of the System-assigned Managed Identity')
output managedIdentityPrincipalId string = appService.identity.principalId

@description('The principal ID of the pre-production slot Managed Identity (if created)')
output slotManagedIdentityPrincipalId string = environment == 'prod' ? preProductionSlot.identity.principalId : ''
