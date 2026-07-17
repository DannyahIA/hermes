import { authClient } from './client';

export const signIn = () => authClient.signIn.social({ provider: 'github' });
export const signOut = () => authClient.signOut();
export const getSession = () => authClient.getSession();
