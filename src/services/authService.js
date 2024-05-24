import { useAuth0 } from '@auth0/auth0-react';

export const useAuthService = () => {
  const { getIdTokenClaims, getAccessTokenSilently } = useAuth0();

  const fetchIdToken = async () => {
    try {
      const claims = await getIdTokenClaims();
      const expiryTime = claims.exp * 1000;
      const currentTime = new Date().getTime();

      if (expiryTime - currentTime < 60000) {
        await getAccessTokenSilently({
          audience: process.env.AUTH0_AUDIENCE,
          scope: 'openid profile email offline_access',
          grant_type: 'refresh_token',
          ignoreCache: true,
          cacheMode: 'off',
        });
        return claims.__raw;
      } else {
        return claims.__raw;
      }
    } catch (error) {
      console.error('Error refreshing ID token:', error);
      throw error;
    }
  };

  return { fetchIdToken };
};
