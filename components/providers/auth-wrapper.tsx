'use client';

import { useEffect, useState } from 'react';
import { AuthService } from '../../services/auth';
import { useSelector, useDispatch } from 'react-redux';
import { IUserStateReducer, authStoreActions } from "../../store/auth";
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
    } catch (error) {
      console.error('Error getting user details after auth:', error);
    }
  };

  return <ModernAuth onAuthSuccess={handleAuthSuccess} />;
}