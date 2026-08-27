'use client';

import { useEffect, useState } from 'react';
import { AuthService } from '../../services/auth';
import { ConfigurationService } from '../../services/config';
import { useSelector, useDispatch } from 'react-redux';
import { IUserStateReducer, authStoreActions } from "../../store/auth";
import { configStoreActions } from "../../store/config";
import { IUser } from '@/types/user';
import { ModernAuth } from '../auth/modern-auth';
import { Box, CircularProgress } from '@mui/material';

interface AuthWrapperProps {
  children: React.ReactNode;
}

export function AuthWrapper({ children }: AuthWrapperProps) {
  const [isLoading, setIsLoading] = useState(true);
  const currentUser = useSelector((state:IUserStateReducer) => {
    return state.authReducer.user
  });
  const dispatch = useDispatch();

  // Load the analysis configuration into Redux app-wide, once the user is authenticated.
  // Previously config was loaded only by the Home page, so navigating directly to (or
  // refreshing on) other pages like /analyze left them without config — e.g. the analyze
  // page rendered half-blank with no Analysis Settings. Loading it here guarantees config
  // is present on every route. Runs after auth is confirmed, so Amplify is configured;
  // getCustomConfig() uses Amplify, and we fall back to the static default config on any error.
  const loadAppConfig = async (identityId?: string) => {
    const configService = new ConfigurationService();
    try {
      if (identityId) {
        const customConfig = await configService.getCustomConfig(identityId);
        dispatch(configStoreActions.setConfig(customConfig));
        return;
      }
    } catch {
      // fall through to default config
    }
    try {
      const defaultConfig = await configService.getDefaultConfig();
      dispatch(configStoreActions.setConfig(defaultConfig));
    } catch (err) {
      console.error('Failed to load configuration:', err);
    }
  };

  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const isAuthenticated = await AuthService.isAuthenticated();
        console.log('isAuthenticated', isAuthenticated);
        if (isAuthenticated) {
          try {
            const identityId = await AuthService.getIdentityId();
            const user = await AuthService.getCurrentUser();
            dispatch(authStoreActions.setUser({
              id: user.userId,
              name: user.username,
              loginId: user.signInDetails?.loginId || '',
              identityId: identityId || ''
            }));
            await loadAppConfig(identityId);
          } catch (error) {
            console.error('Error getting user details:', error);
          }
        }
      } catch (error) {
        console.log('Not authenticated', error);
        dispatch(authStoreActions.setUser(undefined));
      } finally {
        setIsLoading(false);
      }
    };

    checkAuthStatus();
  }, []);

  // Show loading spinner while checking auth status
  if (isLoading) {
    return (
      <Box sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%)'
      }}>
        <CircularProgress size={40} sx={{ color: '#8a2be2' }} />
      </Box>
    );
  }

  // If authenticated, show the app
  if (currentUser) {
    return (
      <>
        {children}
      </>
    );
  }

  // If not authenticated, show the ModernAuth
  const handleAuthSuccess = async (result: any) => {
    try {
      const identityId = await AuthService.getIdentityId();
      const user = await AuthService.getCurrentUser();
      dispatch(authStoreActions.setUser({
        id: user.userId,
        name: user.username,
        loginId: user.signInDetails?.loginId || '',
        identityId: identityId || ''
      }));
      await loadAppConfig(identityId);
    } catch (error) {
      console.error('Error getting user details after auth:', error);
    }
  };

  return <ModernAuth onAuthSuccess={handleAuthSuccess} />;
}