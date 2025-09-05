import { DYNAMICS_ODATA_PREFER, buildCrmApiBaseUrl, buildTokenEndpoint } from './dynamics.constants';
import { DynamicsEmployeeSimple, DynamicsEmployeesOptions, DynamicsServiceConfig, DynamicsSite, DynamicsUserRaw } from './dynamics.types';

export class DynamicsService {
  private config: DynamicsServiceConfig;

  constructor(config: DynamicsServiceConfig) {
    this.config = config;
  }

  private async getToken(): Promise<string> {
    const tokenEndpoint = buildTokenEndpoint(this.config.tenantId);
    const formBody = new URLSearchParams();
    formBody.set('grant_type', 'client_credentials');
    formBody.set('client_id', this.config.appId);
    formBody.set('client_secret', this.config.appSecret);
    formBody.set('scope', this.config.scope);

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formBody.toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Dynamics token request failed (${response.status}): ${text}`);
    }

    const data: any = await response.json();
    return data.access_token as string;
  }

  private async fetchJson<T>(url: string, token: string): Promise<T> {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'Prefer': DYNAMICS_ODATA_PREFER,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Dynamics request failed (${response.status}): ${text}`);
    }

    return response.json() as Promise<T>;
  }

  private async getSites(token: string): Promise<DynamicsSite[]> {
    const baseUrl = buildCrmApiBaseUrl(this.config.tenant);
    const url = `${baseUrl}/sites`;
    const data = await this.fetchJson<{ value: DynamicsSite[] }>(url, token);
    return data.value;
  }

  private toSimpleEmployee(
    user: DynamicsUserRaw,
    sites: DynamicsSite[],
    isActive: boolean
  ): DynamicsEmployeeSimple {
    const defaultSite = user._siteid_value
      ? (sites.find(s => s.siteid === user._siteid_value)?.name ?? null)
      : null;

    const roleFormattedKey = 'ssw_profilecategory@OData.Community.Display.V1.FormattedValue';

    return {
      userId: user.systemuserid,
      fullName: user.fullname,
      defaultSite,
      jobTitle: user.title || '',
      role: (user[roleFormattedKey] as string) || '',
      isActive,
      nickname: user.nickname || '',
      blogUrl: user.ssw_blogurl || '',
      facebookUrl: user.ssw_facebookurl || '',
      skypeUsername: user.ssw_skypeusername || '',
      linkedInUrl: user.ssw_linkedinurl || '',
      twitterUsername: user.ssw_twitterusername || '',
      gitHubUrl: user.ssw_githuburl || '',
    };
  }

  private async getEmployeesByView(token: string, sites: DynamicsSite[], savedQueryId: string, isActive: boolean): Promise<DynamicsEmployeeSimple[]> {
    const baseUrl = buildCrmApiBaseUrl(this.config.tenant);
    const url = `${baseUrl}/systemusers?savedQuery=${encodeURIComponent(savedQueryId)}`;
    const data = await this.fetchJson<{ value: DynamicsUserRaw[] }>(url, token);
    return data.value.map(user => this.toSimpleEmployee(user, sites, isActive));
  }

  async getEmployees(options: DynamicsEmployeesOptions): Promise<DynamicsEmployeeSimple[]> {
    const token = await this.getToken();
    const sites = await this.getSites(token);

    const employees: DynamicsEmployeeSimple[] = [];

    if (options.includeCurrent && process.env.CRM_VIEW_CURRENT) {
      const current = await this.getEmployeesByView(token, sites, process.env.CRM_VIEW_CURRENT, true);
      employees.push(...current);
    }

    if (options.includePast && process.env.CRM_VIEW_PAST) {
      const past = await this.getEmployeesByView(token, sites, process.env.CRM_VIEW_PAST, false);
      employees.push(...past);
    }

    return employees;
  }

  async findEmployeeByGitHub(
    query: string,
    options: DynamicsEmployeesOptions = { includeCurrent: true, includePast: true }
  ): Promise<DynamicsEmployeeSimple | null> {
    const q = (query || '').toLowerCase();
    if (!q) return null;

    const employees = await this.getEmployees(options);
    return employees.find(e => (e.gitHubUrl || '').toLowerCase().includes(q)) ?? null;
  }
}

export function createDynamicsService(): DynamicsService {
  const tenant = process.env.CRM_TENANT as string;
  const tenantId = process.env.CRM_TENANT_ID as string;
  const appId = process.env.CRM_APP_ID as string;
  const appSecret = process.env.CRM_APP_SECRET as string;
  const scope = process.env.CRM_SCOPE as string;

  if (!tenant || !tenantId || !appId || !appSecret || !scope) {
    throw new Error('Missing Dynamics CRM environment variables (CRM_TENANT, CRM_TENANT_ID, CRM_APP_ID, CRM_APP_SECRET, CRM_SCOPE).');
  }

  return new DynamicsService({ tenant, tenantId, appId, appSecret, scope });
}

