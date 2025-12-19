export interface DynamicsServiceConfig {
  tenant: string; // e.g., yourorg.crm.dynamics.com
  tenantId: string; // Azure AD tenant ID (GUID)
  appId: string; // Client ID
  appSecret: string; // Client Secret
  scope: string; // e.g., https://yourorg.crm.dynamics.com/.default
}

export interface DynamicsSite {
  siteid: string;
  name: string;
}

export interface DynamicsUserRaw {
  systemuserid: string;
  fullname: string;
  _siteid_value?: string;
  title?: string;
  nickname?: string;
  ssw_blogurl?: string;
  ssw_facebookurl?: string;
  ssw_skypeusername?: string;
  ssw_linkedinurl?: string;
  ssw_twitterusername?: string;
  ssw_githuburl?: string;
  [key: string]: any;
}

export interface DynamicsEmployeeSimple {
  userId: string;
  fullName: string;
  defaultSite: string | null;
  jobTitle: string;
  role: string;
  isActive: boolean;
  nickname: string;
  blogUrl: string;
  facebookUrl: string;
  skypeUsername: string;
  linkedInUrl: string;
  twitterUsername: string;
  gitHubUrl: string;
}

export interface DynamicsEmployeesOptions {
  includeCurrent: boolean;
  includePast: boolean;
}

