import { useAuth0 } from '@auth0/auth0-react';

export const useAuthService = () => {
  const { getAccessTokenSilently } = useAuth0();

  const fetchAccessToken = async () => {
    try {
      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: process.env.AUTH0_AUDIENCE,
          scope: process.env.AUTH0_SCOPE,
        },
        cacheMode: 'on',
      });
      return token;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to fetch access token', e);
      return null;
    }
  };

  return { fetchAccessToken };
};
