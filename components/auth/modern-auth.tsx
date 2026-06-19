'use client';

import React, { useState } from 'react';
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  IconButton,
  InputAdornment,
  Fade,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Lock,
  Person,
} from '@mui/icons-material';
import { signUp, signIn, confirmSignUp, resendSignUpCode } from 'aws-amplify/auth';

interface ModernAuthProps {
  onAuthSuccess: (user: any) => void;
}

export function ModernAuth({ onAuthSuccess }: ModernAuthProps) {
  const [mode, setMode] = useState<'signin' | 'signup' | 'confirm'>('signin');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    confirmationCode: '',
  });

  const handleInputChange = (field: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [field]: event.target.value }));
    setError('');
  };

  const handleSignIn = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await signIn({
        username: formData.username,
        password: formData.password,
      });
      onAuthSuccess(result);
    } catch (err: any) {
      setError(err.message || 'Sign in failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    setLoading(true);
    setError('');
    try {
      await signUp({
        username: formData.username,
        password: formData.password,
        options: {
          userAttributes: {
            email: formData.email,
          },
        },
      });
      setMode('confirm');
      setSuccess('Please check for the confirmation code');
    } catch (err: any) {
      setError(err.message || 'Sign up failed');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmSignUp = async () => {
    setLoading(true);
    setError('');
    try {
      await confirmSignUp({
        username: formData.username,
        confirmationCode: formData.confirmationCode,
      });
      setSuccess('Account confirmed! Please sign in.');
      setMode('signin');
    } catch (err: any) {
      setError(err.message || 'Confirmation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    try {
      await resendSignUpCode({ username: formData.username });
      setSuccess('Confirmation code resent');
    } catch (err: any) {
      setError(err.message || 'Failed to resend code');
    }
  };

  const renderSignInForm = () => (
    <Fade in={mode === 'signin'} timeout={300}>
      <Box>
        <Typography variant="h4" sx={{ 
          fontWeight: 700, 
          background: 'linear-gradient(135deg, #8a2be2, #00bcd4)',
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          mb: 1,
          textAlign: 'center'
        }}>
          Welcome Back
        </Typography>
        <Typography variant="body2" sx={{ 
          color: 'rgba(255, 255, 255, 0.6)', 
          mb: 4, 
          textAlign: 'center' 
        }}>
          Sign in to your account
        </Typography>

        <TextField
          fullWidth
          label="Username"
          value={formData.username}
          onChange={handleInputChange('username')}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Person sx={{ color: 'rgba(255, 255, 255, 0.5)' }} />
              </InputAdornment>
            ),
          }}
          sx={{ mb: 3 }}
        />

        <TextField
          fullWidth
          label="Password"
          type={showPassword ? 'text' : 'password'}
          value={formData.password}
          onChange={handleInputChange('password')}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Lock sx={{ color: 'rgba(255, 255, 255, 0.5)' }} />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  onClick={() => setShowPassword(!showPassword)}
                  sx={{ color: 'rgba(255, 255, 255, 0.5)' }}
                >
                  {showPassword ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
          }}
          sx={{ mb: 4 }}
        />

        <Button
          fullWidth
          variant="contained"
          size="large"
          onClick={handleSignIn}
          disabled={loading || !formData.username || !formData.password}
          sx={{
            background: 'linear-gradient(135deg, #8a2be2, #00bcd4)',
            border: '1px solid rgba(138, 43, 226, 0.3)',
            borderRadius: 2,
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
            '&:disabled': {
              background: 'rgba(138, 43, 226, 0.3)',
              color: 'rgba(255, 255, 255, 0.5)'
            },
            transition: 'all 0.3s ease',
            mb: 3
          }}
        >
          {loading ? <CircularProgress size={24} color="inherit" /> : 'Sign In'}
        </Button>

        <Typography variant="body2" sx={{ textAlign: 'center', color: 'rgba(255, 255, 255, 0.6)' }}>
          Don't have an account?{' '}
          <Button
            variant="text"
            onClick={() => setMode('signup')}
            sx={{ 
              color: '#8a2be2', 
              textTransform: 'none',
              '&:hover': { color: '#00bcd4' }
            }}
          >
            Sign up
          </Button>
        </Typography>
      </Box>
    </Fade>
  );

  const renderSignUpForm = () => (
    <Fade in={mode === 'signup'} timeout={300}>
      <Box>
        <Typography variant="h4" sx={{ 
          fontWeight: 700, 
          background: 'linear-gradient(135deg, #8a2be2, #00bcd4)',
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          mb: 1,
          textAlign: 'center'
        }}>
          Create Account
        </Typography>
        <Typography variant="body2" sx={{ 
          color: 'rgba(255, 255, 255, 0.6)', 
          mb: 4, 
          textAlign: 'center' 
        }}>
          Join us today
        </Typography>

        <TextField
          fullWidth
          label="Username"
          value={formData.username}
          onChange={handleInputChange('username')}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Person sx={{ color: 'rgba(255, 255, 255, 0.5)' }} />
              </InputAdornment>
            ),
          }}
          sx={{ mb: 3 }}
        />

        <TextField
          fullWidth
          label="Email"
          type="email"
          value={formData.email}
          onChange={handleInputChange('email')}
          sx={{ mb: 3 }}
        />

        <TextField
          fullWidth
          label="Password"
          type={showPassword ? 'text' : 'password'}
          value={formData.password}
          onChange={handleInputChange('password')}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Lock sx={{ color: 'rgba(255, 255, 255, 0.5)' }} />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  onClick={() => setShowPassword(!showPassword)}
                  sx={{ color: 'rgba(255, 255, 255, 0.5)' }}
                >
                  {showPassword ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
          }}
          sx={{ mb: 3 }}
        />

        <TextField
          fullWidth
          label="Confirm Password"
          type={showPassword ? 'text' : 'password'}
          value={formData.confirmPassword}
          onChange={handleInputChange('confirmPassword')}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Lock sx={{ color: 'rgba(255, 255, 255, 0.5)' }} />
              </InputAdornment>
            ),
          }}
          sx={{ mb: 4 }}
        />

        <Button
          fullWidth
          variant="contained"
          size="large"
          onClick={handleSignUp}
          disabled={loading || !formData.username || !formData.email || !formData.password || !formData.confirmPassword}
          sx={{
            background: 'linear-gradient(135deg, #8a2be2, #00bcd4)',
            border: '1px solid rgba(138, 43, 226, 0.3)',
            borderRadius: 2,
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
            '&:disabled': {
              background: 'rgba(138, 43, 226, 0.3)',
              color: 'rgba(255, 255, 255, 0.5)'
            },
            transition: 'all 0.3s ease',
            mb: 3
          }}
        >
          {loading ? <CircularProgress size={24} color="inherit" /> : 'Create Account'}
        </Button>

        <Typography variant="body2" sx={{ textAlign: 'center', color: 'rgba(255, 255, 255, 0.6)' }}>
          Already have an account?{' '}
          <Button
            variant="text"
            onClick={() => setMode('signin')}
            sx={{ 
              color: '#8a2be2', 
              textTransform: 'none',
              '&:hover': { color: '#00bcd4' }
            }}
          >
            Sign in
          </Button>
        </Typography>
      </Box>
    </Fade>
  );

  const renderConfirmForm = () => (
    <Fade in={mode === 'confirm'} timeout={300}>
      <Box>
        <Typography variant="h4" sx={{ 
          fontWeight: 700, 
          background: 'linear-gradient(135deg, #8a2be2, #00bcd4)',
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          mb: 1,
          textAlign: 'center'
        }}>
          Confirm Account
        </Typography>
        <Typography variant="body2" sx={{ 
          color: 'rgba(255, 255, 255, 0.6)', 
          mb: 4, 
          textAlign: 'center' 
        }}>
          Enter the confirmation code sent to you
        </Typography>

        <TextField
          fullWidth
          label="Confirmation Code"
          value={formData.confirmationCode}
          onChange={handleInputChange('confirmationCode')}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Person sx={{ color: 'rgba(255, 255, 255, 0.5)' }} />
              </InputAdornment>
            ),
          }}
          sx={{ mb: 4 }}
        />

        <Button
          fullWidth
          variant="contained"
          size="large"
          onClick={handleConfirmSignUp}
          disabled={loading || !formData.confirmationCode}
          sx={{
            background: 'linear-gradient(135deg, #8a2be2, #00bcd4)',
            border: '1px solid rgba(138, 43, 226, 0.3)',
            borderRadius: 2,
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
            '&:disabled': {
              background: 'rgba(138, 43, 226, 0.3)',
              color: 'rgba(255, 255, 255, 0.5)'
            },
            transition: 'all 0.3s ease',
            mb: 3
          }}
        >
          {loading ? <CircularProgress size={24} color="inherit" /> : 'Confirm Account'}
        </Button>

        <Typography variant="body2" sx={{ textAlign: 'center', color: 'rgba(255, 255, 255, 0.6)' }}>
          Didn't receive the code?{' '}
          <Button
            variant="text"
            onClick={handleResendCode}
            sx={{ 
              color: '#8a2be2', 
              textTransform: 'none',
              '&:hover': { color: '#00bcd4' }
            }}
          >
            Resend
          </Button>
        </Typography>
      </Box>
    </Fade>
  );

  return (
    <Box sx={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%)',
      position: 'relative',
      overflow: 'hidden',
      '&::before': {
        content: '""',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'radial-gradient(circle at 20% 80%, rgba(138, 43, 226, 0.1) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(0, 188, 212, 0.1) 0%, transparent 50%)',
        pointerEvents: 'none',
      }
    }}>
      <Paper sx={{
        p: 5,
        maxWidth: 400,
        width: '100%',
        mx: 2,
        background: 'linear-gradient(145deg, rgba(26, 26, 46, 0.9) 0%, rgba(22, 33, 62, 0.9) 100%)',
        border: '1px solid rgba(138, 43, 226, 0.3)',
        borderRadius: 3,
        boxShadow: '0 0 50px rgba(138, 43, 226, 0.4), 0 0 100px rgba(0, 188, 212, 0.2)',
        backdropFilter: 'blur(20px)',
        position: 'relative',
        zIndex: 1,
      }}>
        {error && (
          <Alert severity="error" sx={{ mb: 3, backgroundColor: 'rgba(244, 67, 54, 0.1)', color: '#f44336' }}>
            {error}
          </Alert>
        )}
        
        {success && (
          <Alert severity="success" sx={{ mb: 3, backgroundColor: 'rgba(76, 175, 80, 0.1)', color: '#4caf50' }}>
            {success}
          </Alert>
        )}

        {mode === 'signin' && renderSignInForm()}
        {mode === 'signup' && renderSignUpForm()}
        {mode === 'confirm' && renderConfirmForm()}
      </Paper>
    </Box>
  );
}