"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDispatch } from 'react-redux';
import { ConfigurationService } from '../services/config';
import { AuthService } from '../services/auth';
import { configStoreActions } from '../store/config';
import {
  Button,
  Typography,
  Box,
  Paper,
  Backdrop,
  CircularProgress,
  Snackbar,
  Alert,
  Dialog,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import HistoryIcon from '@mui/icons-material/History';
import SettingsIcon from '@mui/icons-material/Settings';

import styles from './page.module.css';

export default function HomePage() {
  const router = useRouter();
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(true);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [notification, setNotification] = useState<{ open: boolean; message: string; severity: 'info' | 'error' }>({ open: false, message: '', severity: 'info' });
  
  const configService = new ConfigurationService();
  
  useEffect(() => {
    // Check if user has seen the welcome modal
    const hasSeenWelcome = localStorage.getItem('hasSeenWelcomeModal');
    if (!hasSeenWelcome) {
      setShowWelcomeModal(true);
    }
    
    const loadConfiguration = async () => {
      try {
        const identityId = await AuthService.getIdentityId();
        if (!identityId) {
          throw new Error('No identity ID found');
        }
        
        const customConfig = await configService.getCustomConfig(identityId);
        dispatch(configStoreActions.setConfig(customConfig));
        console.log('Custom configuration loaded successfully');
        setNotification({ open: true, message: 'Using CUSTOM configuration file', severity: 'info' });
      } catch (customError) {
        try {
          const defaultConfig = await configService.getDefaultConfig();
          dispatch(configStoreActions.setConfig(defaultConfig));
          
          const configJson = JSON.stringify(defaultConfig, null, 2);
          const blob = new Blob([configJson], { type: 'application/json' });
          await configService.uploadDefaultConfig(blob);

          console.log('Default configuration loaded successfully');
          setNotification({ open: true, message: 'Using DEFAULT configuration file', severity: 'info' });
        } catch (defaultError) {
          setNotification({ open: true, message: 'Could not load or find Default configuration file', severity: 'error' });
        }
      } finally {
        setLoading(false);
      }
    };
    
    loadConfiguration();
  }, []);

  const handleStartAnalysis = () => {
    router.push('/analyze');
  };

  const handleViewHistory = () => {
    router.push('/history');
  };

  const handleViewSettings = () => {
    router.push('/config');
  };

  return (
    <div className={styles['home-container']}>
      <Dialog
        open={showWelcomeModal}
        maxWidth="sm"
        fullWidth
        disableEscapeKeyDown
        PaperProps={{
          sx: {
            background: 'linear-gradient(145deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%)',
            border: '1px solid rgba(138, 43, 226, 0.3)',
            borderRadius: 3,
            boxShadow: '0 0 50px rgba(138, 43, 226, 0.4), 0 0 100px rgba(0, 188, 212, 0.2)',
            backdropFilter: 'blur(20px)',
          }
        }}
        BackdropProps={{
          sx: {
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            backdropFilter: 'blur(8px)',
          }
        }}
      >
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h4" sx={{ 
            fontWeight: 700, 
            background: 'linear-gradient(135deg, #8a2be2, #00bcd4)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            mb: 1
          }}>
            Welcome
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.6)', mb: 4 }}>
            Please review these important points
          </Typography>
          
          <Box sx={{ textAlign: 'left', mb: 4 }}>
            {[
              'Your data is visible to only you, and the admin, but not to other users',
              'Your data may be deleted at any time', 
              'Do not upload extreme content'
            ].map((text, index) => (
              <Box key={index} sx={{ 
                display: 'flex', 
                alignItems: 'flex-start', 
                mb: 2.5
              }}>
                <Box sx={{ 
                  width: 6, 
                  height: 6, 
                  borderRadius: '50%', 
                  background: 'linear-gradient(135deg, #8a2be2, #00bcd4)',
                  mt: 1,
                  mr: 2,
                  flexShrink: 0
                }} />
                <Typography sx={{ color: 'rgba(255, 255, 255, 0.9)', lineHeight: 1.5 }}>
                  {text}
                </Typography>
              </Box>
            ))}
          </Box>
          
          <Button
            variant="contained"
            size="large"
            onClick={() => {
              localStorage.setItem('hasSeenWelcomeModal', 'true');
              setShowWelcomeModal(false);
            }}
            sx={{
              background: 'linear-gradient(135deg, #8a2be2, #00bcd4)',
              border: '1px solid rgba(138, 43, 226, 0.3)',
              borderRadius: 2,
              px: 4,
              py: 1.5,
              fontSize: '1.1rem',
              fontWeight: 600,
              textTransform: 'none',
              boxShadow: '0 0 20px rgba(138, 43, 226, 0.3)',
              '&:hover': {
                background: 'linear-gradient(135deg, #7a1fd2, #00acc1)',
                boxShadow: '0 0 30px rgba(138, 43, 226, 0.5)',
                transform: 'translateY(-1px)'
              },
              transition: 'all 0.3s ease'
            }}
          >
            Let's go!
          </Button>
        </Box>
      </Dialog>
      <Box sx={{ maxWidth: 1200, margin: '40px auto', p: 3, textAlign: 'center' }}>
        <Typography variant="h3" sx={{ mb: 2, fontWeight: 600 }}>
          Content Compliance Dashboard
        </Typography>
        <Typography variant="h6" sx={{ mb: 4, color: 'text.secondary' }}>
          Welcome to the Media Analysis Content Compliance Solution
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 3, justifyContent: 'center', flexWrap: 'wrap', alignItems: 'stretch' }}>
          <Paper sx={{ p: 4, bgcolor: 'rgba(26, 26, 46, 0.6)', borderRadius: 2, minWidth: 300, flex: 1, maxWidth: 350 }}>
            <PlayArrowIcon sx={{ fontSize: 48, mb: 2, color: '#8a2be2' }} />
            <Typography variant="h5" sx={{ mb: 2, fontWeight: 500 }}>
              Start Analysis
            </Typography>
            <Typography sx={{ mb: 3, color: 'text.secondary' }}>
              Upload and analyze your video content for compliance issues
            </Typography>
            <Button
              variant="contained"
              size="large"
              onClick={handleStartAnalysis}
              sx={{ 
                backgroundImage: 'linear-gradient(135deg, #8a2be2 0%, #00bcd4 100%)',
                '&:hover': {
                  backgroundImage: 'linear-gradient(135deg, #7a1fd2 0%, #00acc1 100%)',
                }
              }}
            >
              Analyze Video
            </Button>
          </Paper>

          <Paper sx={{ p: 4, bgcolor: 'rgba(26, 26, 46, 0.6)', borderRadius: 2, minWidth: 300, flex: 1, maxWidth: 350 }}>
            <HistoryIcon sx={{ fontSize: 48, mb: 2, color: '#ff9800' }} />
            <Typography variant="h5" sx={{ mb: 2, fontWeight: 500 }}>
              Analysis History
            </Typography>
            <Typography sx={{ mb: 3, color: 'text.secondary' }}>
              View your previously analyzed content and results
            </Typography>
            <Button
              variant="contained"
              size="large"
              onClick={handleViewHistory}
              sx={{ 
                backgroundImage: 'linear-gradient(135deg, #ff9800 0%, #8a2be2 100%)',
                '&:hover': {
                  backgroundImage: 'linear-gradient(135deg, #f57c00 0%, #7a1fd2 100%)',
                }
              }}
            >
              View History
            </Button>
          </Paper>

          <Paper sx={{ p: 4, bgcolor: 'rgba(26, 26, 46, 0.6)', borderRadius: 2, minWidth: 300, flex: 1, maxWidth: 350 }}>
            <SettingsIcon sx={{ fontSize: 48, mb: 2, color: '#9c27b0' }} />
            <Typography variant="h5" sx={{ mb: 2, fontWeight: 500 }}>
              Configuration Settings
            </Typography>
            <Typography sx={{ mb: 3, color: 'text.secondary' }}>
              Manage your analysis configuration and preferences
            </Typography>
            <Button
              variant="contained"
              size="large"
              onClick={handleViewSettings}
              sx={{ 
                backgroundImage: 'linear-gradient(135deg, #9c27b0 0%, #673ab7 100%)',
                '&:hover': {
                  backgroundImage: 'linear-gradient(135deg, #8e24aa 0%, #5e35b1 100%)',
                }
              }}
            >
              View Settings
            </Button>
          </Paper>
        </Box>
      </Box>
      
      <Backdrop open={loading} sx={{ zIndex: 9999, flexDirection: 'column', gap: 2 }}>
        <CircularProgress color="inherit" />
        <Typography color="inherit" variant="h6">Loading configuration...</Typography>
      </Backdrop>
      
      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={() => setNotification({ ...notification, open: false })}
      >
        <Alert severity={notification.severity} onClose={() => setNotification({ ...notification, open: false })}>
          {notification.message}
        </Alert>
      </Snackbar>
    </div>
  );
}