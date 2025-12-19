export const DYNAMICS_ODATA_PREFER = 'odata.include-annotations=OData.Community.Display.V1.FormattedValue';

export const buildTokenEndpoint = (tenantId: string) =>
  `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

export const buildCrmApiBaseUrl = (tenant: string) =>
  `https://${tenant}/api/data/v9.1`;

