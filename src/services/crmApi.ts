import axios from 'axios';
import queryString from 'query-string';

const APP_ID = process.env.CRM_APP_ID;
const APP_SECRET: string = process.env.CRM_APP_SECRET || '';
const SCOPE = process.env.CRM_SCOPE;
const TENANT = process.env.CRM_TENANT;
const TENANT_ID = process.env.CRM_TENANT_ID;
const TOKEN_ENDPOINT = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;
const CRM_URL = `https://${TENANT}/api/data/v9.1`;

export const getViewDataFromCRM = async () => {
  const accessToken = await getToken();

  axios.defaults.headers.get['Authorization'] = `Bearer ${accessToken}`;
  axios.defaults.headers.common['Prefer'] =
    'odata.include-annotations=OData.Community.Display.V1.FormattedValue';

  const sites = await getSites();

  const currentEmployees = await getEmployees(sites, true);
  const pastEmployees = await getEmployees(sites, false);
  return currentEmployees.concat(pastEmployees);
};

const getSites = async () => {
  const responseSites = await axios.get(`${CRM_URL}/sites`);
  return responseSites.data.value;
};

const getToken = async () => {
  const auth = `${APP_ID}:${encodeURIComponent(APP_SECRET)}`;
  const encoded_auth = Buffer.from(auth).toString('base64');
  axios.defaults.headers.post['Content-Type'] =
    'application/x-www-form-urlencoded';
  axios.defaults.headers.post['Authorization'] = `Basic ${encoded_auth}`;

  const tokenPostData = {
    grant_type: 'client_credentials',
    scope: SCOPE,
  };

  const responsePost = await axios.post(
    TOKEN_ENDPOINT,
    queryString.stringify(tokenPostData)
  );

  return responsePost.data.access_token;
};

const getEmployees = async (sites, current: boolean) => {
  const viewId = current
    ? process.env.CRM_VIEW_CURRENT
    : process.env.CRM_VIEW_PAST;

  const queryFilter = `?savedQuery=${viewId}`;
  const userQuery = `${CRM_URL}/systemusers${queryFilter}`;

  const response = await axios.get(userQuery);
  const employees = convertToSimpleFormat(response.data.value, sites, current);

  return employees;
};

const convertToSimpleFormat = (data, sites, current: boolean) => {
  return data.map((user) => {
    return {
      userId: user.systemuserid,
      fullName: user.fullname,
      defaultSite: user._siteid_value
        ? sites.find((s) => s.siteid === user._siteid_value).name
        : null,
      jobTitle: user.title || '',
      role:
        user['ssw_profilecategory@OData.Community.Display.V1.FormattedValue'] ||
        '',
      isActive: current,
      nickname: user.nickname || '',
      blogUrl: user.ssw_blogurl || '',
      facebookUrl: user.ssw_facebookurl || '',
      skypeUsername: user.ssw_skypeusername || '',
      linkedInUrl: user.ssw_linkedinurl || '',
      twitterUsername: user.ssw_twitterusername || '',
      gitHubUrl: user.ssw_githuburl || '',
    };
  });
};
