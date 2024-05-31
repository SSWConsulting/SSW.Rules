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
          audience: process.env.AUTH0_DOMAIN,
          scope: process.env.AUTH0_SCOPE,
          cacheMode: 'off',
        });

        const refreshedClaims = await getIdTokenClaims();
        return refreshedClaims.__raw;
      }
      return claims.__raw;
    } catch (error) {
      console.log('Failed to fetch id token', error);
    }
  };

  return { fetchIdToken };
};
