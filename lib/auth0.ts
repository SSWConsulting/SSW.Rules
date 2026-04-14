import { Auth0Client } from "@auth0/nextjs-auth0/server";

let _auth0: Auth0Client | undefined;

export function getAuth0(): Auth0Client {
  if (!_auth0) {
    _auth0 = new Auth0Client({
      domain: process.env.AUTH0_DOMAIN!,
      clientId: process.env.AUTH0_CLIENT_ID!,
      clientSecret: process.env.AUTH0_CLIENT_SECRET!,
      appBaseUrl: process.env.AUTH0_REDIRECT_URI!,
      secret: process.env.AUTH0_SECRET!,
      authorizationParameters: {
        audience: process.env.AUTH0_AUDIENCE!,
        //scope: 'openid profile email'
      }
    });
  }
  return _auth0;
}