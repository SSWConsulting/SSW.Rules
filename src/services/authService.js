import { useAuth0 } from '@auth0/auth0-react';

export const useAuthService = () => {
  const { getIdTokenClaims, getAccessTokenSilently, loginWithRedirect } =
    useAuth0();

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
      if (window.confirm('Your session has expired. Please log in again')) {
        const currentPage =
          typeof window !== 'undefined'
            ? window.location.pathname.split('/').pop()
            : null;
        await loginWithRedirect({
          appState: {
            targetUrl: currentPage,
          },
        });
      }
    }
  };

  return { fetchIdToken };
};
