'use client';

// Configure Amplify before any other imports
import '../lib/amplify-config';

// core styles are required for all packages
// import '@mantine/core/styles.css';
// import "./app.css";
// Supports weights 100-900
import '@fontsource-variable/raleway';

import { styled, useTheme, Theme, CSSObject } from '@mui/material/styles';
import Box from '@mui/material/Box';
import MuiDrawer from '@mui/material/Drawer';
import MuiAppBar, { AppBarProps as MuiAppBarProps } from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import List from '@mui/material/List';
import CssBaseline from '@mui/material/CssBaseline';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import DynamicFeedIcon from '@mui/icons-material/DynamicFeed';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import Button from '@mui/material/Button';
import HomeIcon from '@mui/icons-material/Home';
import VideoSettingsIcon from '@mui/icons-material/VideoSettings';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import BarChartIcon from '@mui/icons-material/BarChart';
import HistoryIcon from '@mui/icons-material/History';
import SettingsIcon from '@mui/icons-material/Settings';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import HelpIcon from '@mui/icons-material/Help';
// import Drawer from '@mui/material/Drawer';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import Tooltip from '@mui/material/Tooltip';

import { Inter } from "next/font/google";
import { Providers } from "../components/providers/providers";
import React from 'react';
import { vars } from '../amplify/global-variables';
import { useRouter, usePathname } from 'next/navigation';
import "./globals.css";
import { AuthWrapper } from "../components/providers/auth-wrapper";
import LogMessages from "../components/log-output/log-output";
import { useSelector, useDispatch } from 'react-redux';
import { IUserStateReducer, authStoreActions } from '../store/auth';
import { AuthService } from '../services/auth';
import { IUser } from '../types/user';

const drawerWidth = 180;

interface AppBarProps extends MuiAppBarProps {
  open?: boolean;
}

const AppBar = styled(MuiAppBar, {
  shouldForwardProp: (prop) => prop !== 'open',
})<AppBarProps>(({ theme }) => ({
  zIndex: theme.zIndex.drawer + 1,
  transition: theme.transitions.create(['width', 'margin'], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  variants: [
    {
      props: ({ open }) => open,
      style: {
        marginLeft: drawerWidth,
        width: `calc(100% - ${drawerWidth}px)`,
        transition: theme.transitions.create(['width', 'margin'], {
          easing: theme.transitions.easing.sharp,
          duration: theme.transitions.duration.enteringScreen,
        }),
      },
    },
  ],
}));
const DrawerHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  // padding: theme.spacing(0, 1),
  // necessary for content to be below app bar
  ...theme.mixins.toolbar,
}));

// User section component
function UserSection({ currentUser, onLogout }: { currentUser: IUser | undefined, onLogout: () => void }) {
  if (!currentUser) return null;
  
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
        {currentUser.loginId}
      </Typography>
      <Tooltip title="Logout">
        <IconButton
          color="inherit"
          onClick={onLogout}
          sx={{ 
            '&:hover': { 
              backgroundColor: 'rgba(255, 255, 255, 0.1)' 
            } 
          }}
        >
          <PowerSettingsNewIcon />
        </IconButton>
      </Tooltip>
    </Box>
  );
}

// Create a custom dark theme with modern, slick color scheme
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#8a2be2', // Vibrant purple
    },
    secondary: {
      main: '#00bcd4', // Cyan
    },
    background: {
      default: '#1a1a2e',
      paper: '#16213e',
    },
  },
  typography: {
    fontFamily: 'Raleway Variable',
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
          boxShadow: '0 3px 5px 2px rgba(15, 52, 96, 0.3)',
        },
      },
    },
    MuiToolbar: {
      styleOverrides: {
        root: {
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)',
          borderRight: '1px solid rgba(138, 43, 226, 0.1)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 8,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            borderRadius: 12,
            '& fieldset': {
              borderColor: 'rgba(138, 43, 226, 0.3)',
              borderWidth: 1,
            },
            '&:hover fieldset': {
              borderColor: 'rgba(138, 43, 226, 0.5)',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#8a2be2',
              borderWidth: 2,
            },
          },
          '& .MuiInputLabel-root': {
            color: 'rgba(255, 255, 255, 0.7)',
            '&.Mui-focused': {
              color: '#8a2be2',
            },
          },
          '& .MuiOutlinedInput-input': {
            color: '#ffffff',
          },
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          border: '1px solid',
        },
        standardError: {
          backgroundColor: 'rgba(244, 67, 54, 0.1)',
          borderColor: 'rgba(244, 67, 54, 0.3)',
          color: '#f44336',
        },
        standardSuccess: {
          backgroundColor: 'rgba(76, 175, 80, 0.1)',
          borderColor: 'rgba(76, 175, 80, 0.3)',
          color: '#4caf50',
        },
      },
    },
  },
});

function LayoutContent({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(true);
  const router = useRouter();
  const currentUser = useSelector((state: IUserStateReducer) => state.authReducer.user);
  const dispatch = useDispatch();

  const toggleDrawer = () => {
    setOpen(!open);
  };

  const handleNavigation = (path: string) => {
    router.push(path);
  };

  const handleLogout = async () => {
    try {
      await AuthService.signOut();
      dispatch(authStoreActions.setUser(undefined));
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const menuItems = [
    { text: 'Home', icon: <HomeIcon />, path: '/' },
    { text: 'Analyze', icon: <VideoSettingsIcon />, path: '/analyze' },
    // { text: 'Library', icon: <VideoLibraryIcon />, path: '/library' },
    { text: 'Statistics', icon: <BarChartIcon />, path: '/statistics' },
    { text: 'History', icon: <HistoryIcon />, path: '/history' },
    { text: 'Config', icon: <SettingsIcon />, path: '/config' },
    { text: 'Architecture', icon: <AccountTreeIcon />, path: '/architecture' },
    { text: 'Help', icon: <HelpIcon />, path: '/help' },
  ];

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AppBar position="fixed" elevation={0} sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="toggle drawer"
            onClick={toggleDrawer}
            edge="start"
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
          <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1, gap: 2 }}>
            <img src="/AWS_logo_white.svg" alt="AWS" style={{ height: '24px', width: 'auto' }} />
            <Typography variant="h6" noWrap component="div">
              Content Compliance Demo
            </Typography>
          </Box>
          <UserSection currentUser={currentUser} onLogout={handleLogout} />
        </Toolbar>
      </AppBar>
      
      <MuiDrawer
        variant="permanent"
        open={open}
        sx={{
          width: open ? drawerWidth : darkTheme.spacing(0),
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: open ? drawerWidth : darkTheme.spacing(7),
            overflowX: 'hidden',
            transition: darkTheme.transitions.create('width', {
              easing: darkTheme.transitions.easing.sharp,
              duration: darkTheme.transitions.duration.enteringScreen,
            }),
          },
        }}
      >
        <DrawerHeader />
        <List>
          {menuItems.map((item, index) => (
            <ListItem key={item.text} disablePadding sx={{ display: 'block' }}>
              <ListItemButton
                onClick={() => handleNavigation(item.path)}
                sx={{
                  minHeight: 48,
                  justifyContent: open ? 'initial' : 'center',
                  px: 2.5,
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 0,
                    mr: open ? 3 : 'auto',
                    justifyContent: 'center',
                    color: '#ffffff',
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText 
                  primary={item.text} 
                  slotProps={{
                    primary: {
                      fontSize: 14,
                    },
                  }}
                  sx={{ display: open ? 'auto' : 'none' }}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
        <Box sx={{ 
          position: 'absolute', 
          bottom: 16, 
          left: 16, 
          right: 16,
          display: open ? 'block' : 'none'
        }}>
          <Typography variant="caption" sx={{ 
            color: 'rgba(255, 255, 255, 0.5)', 
            fontSize: '0.95rem' 
          }}>
            version 1.3.0
          </Typography>
        </Box>
      </MuiDrawer>
      
      <Box component="main" sx={{ 
        flexGrow: 1, 
        mt: 7.4, 
        ml: open ? 0 : 6,
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        minHeight: 'calc(100vh - 64px)'
      }}>
        {children}
      </Box>
    </Box>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <title>Media Analysis: Content Compliance Solution</title>
        <link rel="icon" href="/AWS_logo_white.svg" type="image/svg+xml" />
      </head>
      <body>
        <Providers>
          <ThemeProvider theme={darkTheme}>
            <AuthWrapper>
              <LayoutContent>{children}</LayoutContent>
            </AuthWrapper>
          </ThemeProvider>
        </Providers>
      </body>
    </html>
  );
}