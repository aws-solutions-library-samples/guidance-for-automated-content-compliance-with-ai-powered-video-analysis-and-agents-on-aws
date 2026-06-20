"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useDispatch, useSelector } from 'react-redux';
import {
  Stepper,
  Step,
  StepLabel,
  Button,
  Typography,
  Box,
  Paper,
  Backdrop,
  CircularProgress,
  Snackbar,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  Chip,

} from '@mui/material';
import { styled, keyframes } from '@mui/material/styles';
import StepConnector, { stepConnectorClasses } from '@mui/material/StepConnector';
import { StepIconProps } from '@mui/material/StepIcon';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

import { AssetsService } from '../../services/assets';
import { CommonUtils } from '../../amplify/utils';
import { logMessagesStoreActions } from '../../store/log-output';
import { ILogMessagesStateReducer } from '../../store/log-output';
import LogMessages from '../../components/log-output/log-output';
import { CONTENT_TYPES, BedrockModelIds, vars, modelSupportsSamplingParams } from '../../amplify/global-variables';
import ModelSelector from '../../components/model-selector/model-selector';
import { IConfigStateReducer } from '../../store/config';
import NestedPill from '../../components/nested-pill/nested-pill';

type ContentType = keyof typeof CONTENT_TYPES;

const ellipsisAnimation = keyframes`
  0%, 80%, 100% {
    opacity: 0;
  }
  40% {
    opacity: 1;
  }
`;

const LoadingEllipsis = styled(Box)(() => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  marginLeft: '12px',
  '& span': {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#ffffff',
    animation: `${ellipsisAnimation} 1.4s infinite ease-in-out`,
    '&:nth-of-type(1)': {
      animationDelay: '-0.32s',
    },
    '&:nth-of-type(2)': {
      animationDelay: '-0.16s',
    },
  },
}));

const checkmarkDraw = keyframes`
  0% {
    stroke-dashoffset: 100;
  }
  100% {
    stroke-dashoffset: 0;
  }
`;

const confettiBurst = keyframes`
  0% {
    opacity: 1;
    transform: scale(0) rotate(0deg) translateY(0);
  }
  50% {
    opacity: 1;
    transform: scale(1.5) rotate(180deg) translateY(-30px);
  }
  100% {
    opacity: 0;
    transform: scale(0.5) rotate(360deg) translateY(-60px);
  }
`;

const CompletionAnimation = styled(Box)(() => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '16px',
  margin: '32px 0',
  position: 'relative',
  overflow: 'visible',
  '& .checkmark': {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    border: '3px solid #4caf50',
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    '& svg': {
      width: '40px',
      height: '40px',
      '& path': {
        stroke: '#4caf50',
        strokeWidth: '3',
        strokeDasharray: '100',
        strokeDashoffset: '100',
        animation: `${checkmarkDraw} 0.8s ease-in-out 0.3s forwards`,
        fill: 'none',
      },
    },
  },
  '& .confetti': {
    position: 'absolute',
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    animation: `${confettiBurst} 2s ease-out forwards`,
    '&:nth-of-type(2)': {
      backgroundColor: '#ff6b6b',
      top: '20px',
      left: '10px',
      animationDelay: '0.0s',
    },
    '&:nth-of-type(3)': {
      backgroundColor: '#4ecdc4',
      top: '15px',
      right: '10px',
      animationDelay: '0.1s',
    },
    '&:nth-of-type(4)': {
      backgroundColor: '#45b7d1',
      top: '30px',
      left: '50%',
      animationDelay: '0.2s',
    },
    '&:nth-of-type(5)': {
      backgroundColor: '#f9ca24',
      top: '10px',
      left: '30%',
      animationDelay: '0.3s',
    },
    '&:nth-of-type(6)': {
      backgroundColor: '#6c5ce7',
      top: '25px',
      right: '30%',
      animationDelay: '0.4s',
    },
    '&:nth-of-type(7)': {
      backgroundColor: '#a29bfe',
      top: '5px',
      left: '70%',
      animationDelay: '0.5s',
    },
    '&:nth-of-type(8)': {
      backgroundColor: '#fd79a8',
      top: '35px',
      right: '50%',
      animationDelay: '0.6s',
    },
    '&:nth-of-type(9)': {
      backgroundColor: '#00b894',
      top: '8px',
      right: '70%',
      animationDelay: '0.7s',
    },
    '&:nth-of-type(10)': {
      backgroundColor: '#e17055',
      top: '40px',
      left: '15%',
      animationDelay: '0.05s',
    },
    '&:nth-of-type(11)': {
      backgroundColor: '#74b9ff',
      top: '12px',
      left: '85%',
      animationDelay: '0.15s',
    },
    '&:nth-of-type(12)': {
      backgroundColor: '#fd79a8',
      top: '28px',
      left: '5%',
      animationDelay: '0.25s',
    },
    '&:nth-of-type(13)': {
      backgroundColor: '#fdcb6e',
      top: '18px',
      right: '5%',
      animationDelay: '0.35s',
    },
    '&:nth-of-type(14)': {
      backgroundColor: '#6c5ce7',
      top: '45px',
      right: '40%',
      animationDelay: '0.45s',
    },
    '&:nth-of-type(15)': {
      backgroundColor: '#00cec9',
      top: '2px',
      left: '60%',
      animationDelay: '0.55s',
    },
    '&:nth-of-type(16)': {
      backgroundColor: '#e84393',
      top: '38px',
      left: '75%',
      animationDelay: '0.65s',
    },
    '&:nth-of-type(17)': {
      backgroundColor: '#00b894',
      top: '22px',
      left: '25%',
      animationDelay: '0.75s',
    },
    '&:nth-of-type(18)': {
      backgroundColor: '#ff7675',
      top: '6px',
      right: '25%',
      animationDelay: '0.85s',
    },
    '&:nth-of-type(19)': {
      backgroundColor: '#a29bfe',
      top: '32px',
      right: '60%',
      animationDelay: '0.95s',
    },
    '&:nth-of-type(20)': {
      backgroundColor: '#ffeaa7',
      top: '14px',
      left: '40%',
      animationDelay: '0.8s',
    },
  },
}));

const ColorlibConnector = styled(StepConnector)(({ theme }) => ({
  [`&.${stepConnectorClasses.alternativeLabel}`]: {
    top: 22,
  },
  [`&.${stepConnectorClasses.active}`]: {
    [`& .${stepConnectorClasses.line}`]: {
      backgroundImage: 'linear-gradient(95deg, #8a2be2 0%, #00bcd4 100%)',
    },
  },
  [`&.${stepConnectorClasses.completed}`]: {
    [`& .${stepConnectorClasses.line}`]: {
      backgroundImage: 'linear-gradient(95deg, #8a2be2 0%, #00bcd4 100%)',
    },
  },
  [`& .${stepConnectorClasses.line}`]: {
    height: 3,
    border: 0,
    backgroundColor: '#2a2a5a',
    borderRadius: 1,
  },
}));

const ColorlibStepIconRoot = styled('div')<{
  ownerState: { completed?: boolean; active?: boolean };
}>(({ theme, ownerState }) => ({
  backgroundColor: '#2a2a5a',
  zIndex: 1,
  color: '#fff',
  width: 50,
  height: 50,
  display: 'flex',
  borderRadius: '50%',
  justifyContent: 'center',
  alignItems: 'center',
  boxShadow: '0 4px 10px 0 rgba(0,0,0,.25)',
  ...(ownerState.active && {
    backgroundImage: 'linear-gradient(135deg, #8a2be2 0%, #00bcd4 100%)',
    boxShadow: '0 4px 10px 0 rgba(138, 43, 226, 0.4)',
  }),
  ...(ownerState.completed && {
    backgroundImage: 'linear-gradient(135deg, #8a2be2 0%, #00bcd4 100%)',
  }),
}));

function ColorlibStepIcon(props: StepIconProps) {
  const { active, completed, className } = props;

  const icons: { [index: string]: React.ReactElement } = {
    1: <CloudUploadIcon />,
    2: <VideoLibraryIcon />,
    3: <CheckCircleIcon />,
  };

  return (
    <ColorlibStepIconRoot ownerState={{ completed, active }} className={className}>
      {icons[String(props.icon)]}
    </ColorlibStepIconRoot>
  );
}

export default function AnalyzePage() {
  const [activeStep, setActiveStep] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [contentType, setContentType] = useState<ContentType | ''>('');
  const [selectedModel, setSelectedModel] = useState<string>(BedrockModelIds.AMAZON_NOVA_LITE);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const assetsService = new AssetsService();
  const dispatch = useDispatch();
  const logMessages = useSelector((state: ILogMessagesStateReducer) => state.logMessagesReducer.messages);
  const router = useRouter();
  const pathname = usePathname();
  const sessionId = useSelector((state: ILogMessagesStateReducer) => state.logMessagesReducer.sessionId);
  const config = useSelector((state: IConfigStateReducer) => state.configReducer.config);
  const hasNavigatedAway = useRef(false);

  const steps = [
    {
      label: 'Upload Video',
      description: 'Upload your video (and optional transcript).',
    },
    {
      label: 'Processing',
      description: 'Your video is being analyzed for content compliance issues.',
    },
    {
      label: 'Results',
      description: 'Loading compliance analysis...',
    },
  ];

  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleReset = () => {
    resetPageState();
  };

  // Reset function to ensure clean state
  const resetPageState = useCallback(() => {
    setActiveStep(0);
    setUploading(false);
    setContentType('');
    setSelectedModel(BedrockModelIds.AMAZON_NOVA_LITE);
    setSnackbar({ open: false, message: '', severity: 'success' });
    dispatch(logMessagesStoreActions.setMessages([]));
    dispatch(logMessagesStoreActions.setSessionId(''));
    isActiveSession.current = false;
  }, [dispatch]);

  // Reset state whenever the pathname changes back to /analyze.
  // This handles client-side navigation (router.push, sidebar nav).
  useEffect(() => {
    if (pathname === '/analyze') {
      resetPageState();
    }
  }, [pathname, resetPageState]);

  // Handle browser back/forward button and page visibility changes.
  // When the user navigates away to results and comes back via
  // history.back(), the component may not remount. This listener
  // catches that case by detecting when the page becomes visible again.
  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      // bfcache restoration or regular pageshow
      if (event.persisted || hasNavigatedAway.current) {
        resetPageState();
        hasNavigatedAway.current = false;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && hasNavigatedAway.current) {
        resetPageState();
        hasNavigatedAway.current = false;
      }
    };

    const handlePopState = () => {
      if (window.location.pathname === '/analyze') {
        resetPageState();
      }
    };

    window.addEventListener('pageshow', handlePageShow);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('pageshow', handlePageShow);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [resetPageState]);

  // Track whether the current session was started by this page instance
  const isActiveSession = useRef(false);

  useEffect(() => {
    if (activeStep === 1 && logMessages.length > 0 && isActiveSession.current) {
      const hasCompletionMessage = logMessages.some(msg => msg.message.includes("General compliance analysis completed successfully"));
      
      if (hasCompletionMessage && sessionId) {
        handleNext();
        setTimeout(() => {
          hasNavigatedAway.current = true;
          router.push(`/analyze/analysis-results/${sessionId}`);
        }, 3000);
      }
    }
  }, [logMessages, activeStep, sessionId, router]);

  const handleAssetUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!contentType) {
      setSnackbar({ open: true, message: 'Please select a content type first.', severity: 'error' });
      return;
    }

    const files = event.target.files;
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    const videoFiles = fileArray.filter(file => {
      const extension = file.name.toLowerCase().split('.').pop();
      return extension === 'mp4';
    });
    const textFiles = fileArray.filter(file => file.type === 'text/plain' || file.name.endsWith('.txt'));

    if (videoFiles.length > 1) {
      setSnackbar({ open: true, message: 'Only one video file is allowed.', severity: 'error' });
      return;
    }
    if (textFiles.length > 1) {
      setSnackbar({ open: true, message: 'Only one text file is allowed.', severity: 'error' });
      return;
    }
    if (videoFiles.length === 0 && textFiles.length === 0) {
      setSnackbar({ open: true, message: 'Please select video and/or text files.', severity: 'error' });
      return;
    }

    setUploading(true);
    try {
      const sessionId = CommonUtils.generateUUID();
      dispatch(logMessagesStoreActions.setSessionId(sessionId));
      isActiveSession.current = true;
      await assetsService.uploadAssets(videoFiles, sessionId, textFiles[0], contentType as ContentType);
      event.target.value = '';
      handleNext();
    } catch (error) {
      console.error('Upload failed:', error);
      setSnackbar({ open: true, message: 'Upload failed. Please try again.', severity: 'error' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Box key={`analyze-${activeStep}-${contentType}`} sx={{ maxWidth: 1400, margin: '40px auto', p: 3 }}>
      <Typography variant="h5" sx={{ mb: 4, fontWeight: 500, textAlign: 'center' }}>
        Analyze your video for compliance...
      </Typography>
      
      <Stepper alternativeLabel activeStep={activeStep} connector={<ColorlibConnector />}>
        {steps.map((step, index) => (
          <Step key={step.label}>
            <StepLabel StepIconComponent={ColorlibStepIcon}>
              <Typography sx={{ fontWeight: 500 }}>{step.label}</Typography>
            </StepLabel>
          </Step>
        ))}
      </Stepper>
      
      {activeStep === steps.length ? (
        <Paper square elevation={0} sx={{ p: 3, mt: 3, bgcolor: 'rgba(26, 26, 46, 0.6)', borderRadius: 2 }}>
          <Typography>All steps completed - your video has been analyzed</Typography>
          <Button onClick={handleReset} sx={{ mt: 1, mr: 1 }}>
            Start New Analysis
          </Button>
        </Paper>
      ) : (
        <>
          <Paper sx={{ p: 3, mt: 3, bgcolor: 'rgba(26, 26, 46, 0.6)', borderRadius: 2 }}>
            {activeStep === 0 && (
              <Box sx={{ mt: 0, mb: 2 }}>
                <Typography variant="h5" sx={{ mb: 2, color: '#ffffff', fontWeight: 500 }}>
                  Upload Video (and optional transcript)
                </Typography>
                <Box sx={{ pb: 1 }} />
                <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <FormControl sx={{ minWidth: 200 }}>
                      <InputLabel>Content Type</InputLabel>
                      <Select
                        value={contentType}
                        label="Content Type"
                        onChange={(e) => setContentType(e.target.value as ContentType)}
                      >
                        {Object.entries(CONTENT_TYPES).map(([key, value]) => (
                          <MenuItem key={key} value={key}>{value}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    {contentType && config?.defaultFramesPerSecond && (
                      <Typography variant="body1" sx={{ color: '#ffffff' }}>
                        Frame rate used for Frame Analysis: <span style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{config.defaultFramesPerSecond[CONTENT_TYPES[contentType]] || 'N/A'} fps</span>
                      </Typography>
                    )}
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                    <input
                      accept=".mp4,.txt"
                      style={{ display: 'none' }}
                      id="asset-upload-button"
                      multiple
                      type="file"
                      onChange={handleAssetUpload}
                    />
                    <label htmlFor="asset-upload-button">
                      <Button
                        variant="contained"
                        component="span"
                        startIcon={<CloudUploadIcon />}
                        disabled={uploading || !contentType || !config?.defaultGeneralReportConfig?.bedrockModelId}
                      >
                        {uploading ? 'Uploading...' : 'Upload asset(s)'}
                      </Button>
                    </label>
                    <Typography variant="caption" sx={{ color: '#b0bec5', fontSize: '0.75rem', fontWeight: 'bold' }}>
                      Supported formats: MP4 (H.264) video, TXT transcript (optional)
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#b0bec5', fontSize: '0.75rem', fontWeight: 'bold' }}>
                      Uploaded transcripts are only used for single segment videos.{' '}
                      <Link href="/help#transcript-faq" style={{ color: '#00bcd4' }}>Learn more</Link>
                    </Typography>
                  </Box>
                </Box>

                {/* Configuration Display */}
                {config && (
                  <Box sx={{ mt: 3 }}>
                    <Divider sx={{ mb: 2 }} />
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h5" sx={{ color: '#ffffff', fontWeight: 500 }}>
                        Analysis Settings
                      </Typography>
                      <Chip 
                        label={config.isCustom ? 'Custom Config Used' : 'Default Config Used'}
                        size="medium"
                        variant="filled"
                        sx={{ 
                          bgcolor: config.isCustom ? 'rgba(76, 175, 80, 0.7)' : 'rgba(138, 43, 226, 0.5)', 
                          color: '#ffffff'
                        }}
                      />
                    </Box>
                    <Typography variant="body2" sx={{ mb: 2, color: '#b0bec5', fontStyle: 'italic' }}>
                      These are the values that will be used for analysis. To modify these settings, visit the{' '}
                      <Link href="/config" style={{ color: '#00bcd4', textDecoration: 'underline' }}>
                        Configuration page
                      </Link>.
                    </Typography>
                    
                    <Box sx={{ display: 'flex', gap: 2 }}>
                      {/* Left Half - House Ratings Configuration */}
                      <Box sx={{ flex: 1.5 }}>
                        <Paper sx={{ p: 2, bgcolor: 'rgba(63, 81, 181, 0.1)', height: '100%' }}>
                          <Typography variant="h6" sx={{ color: '#ffffff', mb: 1 }}>
                            House Rating Categories
                          </Typography>
                          <Typography variant="body2" sx={{ mb: 1, color: '#b0bec5' }}>Categories used for compliance analysis:</Typography>
                          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
                            {/* @ts-ignore */}
                            {(config.houseCategories || []).map(category => (
                              <Box key={category} sx={{ display: 'flex', justifyContent: 'flex-start' }}>
                                <Chip 
                                  label={category}
                                  size="small"
                                  variant="filled"
                                  sx={{ bgcolor: 'rgba(138, 43, 226, 0.5)', color: '#ffffff', fontSize: '0.8rem', fontWeight: 500 }}
                                />
                              </Box>
                            ))}
                          </Box>
                        </Paper>
                      </Box>

                      {/* Right Half - Full Video and Frame Analysis */}
                      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {/* Full Video Analysis Configuration */}
                        <Paper sx={{ p: 2, bgcolor: 'rgba(63, 81, 181, 0.1)' }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                            <Typography variant="h6" sx={{ color: '#ffffff' }}>
                              Full Video Analysis
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#ffffff', fontWeight: 'bold', fontSize: '1rem' }}>
                              Step 1
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
                            <NestedPill 
                              label="Model"
                              value={vars.BEDROCK_MODELS.find(m => m.id === config.defaultGeneralReportConfig?.bedrockModelId)?.name || 'Unknown'}
                            />
                            <NestedPill 
                              label="Max Tokens"
                              value={config.defaultGeneralReportConfig?.inferenceConfig?.maxTokens?.toLocaleString() || 'N/A'}
                            />
                            <NestedPill 
                              label="Temperature"
                              value={config.defaultGeneralReportConfig?.inferenceConfig?.temperature?.toString() || 'N/A'}
                            />
                            <NestedPill 
                              label="Top P"
                              value={config.defaultGeneralReportConfig?.inferenceConfig?.topP?.toString() || 'N/A'}
                            />
                            <NestedPill 
                              label="Top K"
                              value={config.defaultGeneralReportConfig?.inferenceConfig?.topK?.toString() || 'N/A'}
                            />
                          </Box>
                        </Paper>

                        {/* Frame Analysis Configuration */}
                        <Paper sx={{ p: 2, bgcolor: 'rgba(63, 81, 181, 0.1)' }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                            <Typography variant="h6" sx={{ color: '#ffffff' }}>
                              Frame Analysis
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#ffffff', fontWeight: 'bold', fontSize: '1rem' }}>
                              Step 2
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
                            <NestedPill 
                              label="Model"
                              value={vars.BEDROCK_MODELS.find(m => m.id === config.defaultDetailedReportConfig?.bedrockModelId)?.name || 'Unknown'}
                            />
                            <NestedPill 
                              label="Max Tokens"
                              value={config.defaultDetailedReportConfig?.inferenceConfig?.maxTokens?.toLocaleString() || 'N/A'}
                            />
                            <NestedPill 
                              label="Temperature"
                              value={modelSupportsSamplingParams(config.defaultDetailedReportConfig?.bedrockModelId) ? (config.defaultDetailedReportConfig?.inferenceConfig?.temperature?.toString() || 'N/A') : 'N/A'}
                            />
                            <NestedPill 
                              label="Top P"
                              value={modelSupportsSamplingParams(config.defaultDetailedReportConfig?.bedrockModelId) ? (config.defaultDetailedReportConfig?.inferenceConfig?.topP?.toString() || 'N/A') : 'N/A'}
                            />
                            <NestedPill 
                              label="Top K"
                              value={modelSupportsSamplingParams(config.defaultDetailedReportConfig?.bedrockModelId) ? (config.defaultDetailedReportConfig?.inferenceConfig?.topK?.toString() || 'N/A') : 'N/A'}
                            />
                          </Box>
                        </Paper>
                      </Box>
                    </Box>
                  </Box>
                )}
              </Box>
            )}
            
            {activeStep !== 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Typography>{steps[activeStep].description}</Typography>
                  {activeStep === 1 && (
                    <LoadingEllipsis>
                      <span />
                      <span />
                      <span />
                    </LoadingEllipsis>
                  )}
                </Box>
                {sessionId && (
                  <Typography 
                    variant="subtitle2" 
                    sx={{ 
                      color: 'rgba(255, 255, 255, 0.5)', 
                      fontWeight: 300,
                      letterSpacing: '0.1em'
                    }}
                  >
                  Session ID: {sessionId}
                  </Typography>
                )}
              </Box>
            )}
            
            {activeStep === 1 && (
              <Box sx={{ mt: 3, mb: 2, overflowY: 'auto' }}>
                <LogMessages 
                  videoAnalysisWorkflow={true}
                  onViewResults={() => router.push(`/analyze/analysis-results/${sessionId}`)}
                />
              </Box>
            )}
            
            {activeStep === 2 && logMessages.length > 0 && (
              <Box sx={{ mt: 3, mb: 2 }}>
                <CompletionAnimation>
                  <div className="checkmark">
                    <svg viewBox="0 0 24 24">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                    </svg>
                  </div>
                  <div className="confetti" />
                  <div className="confetti" />
                  <div className="confetti" />
                  <div className="confetti" />
                  <div className="confetti" />
                  <div className="confetti" />
                  <div className="confetti" />
                  <div className="confetti" />
                  <div className="confetti" />
                  <div className="confetti" />
                  <div className="confetti" />
                  <div className="confetti" />
                  <div className="confetti" />
                  <div className="confetti" />
                  <div className="confetti" />
                  <div className="confetti" />
                  <div className="confetti" />
                  <div className="confetti" />
                  <div className="confetti" />
                </CompletionAnimation>
                <Box sx={{ textAlign: 'center', mb: 2 }}>
                  <Typography variant="h6" sx={{ color: '#ffffff', mb: 1 }}>
                    Analysis Complete!
                  </Typography>
                </Box>
              </Box>
            )}
          </Paper>
        </>
      )}
      
      <Backdrop open={uploading} sx={{ zIndex: 9999, flexDirection: 'column', gap: 2 }}>
        <CircularProgress color="inherit" />
        <Typography color="inherit" variant="h6">Uploading file(s)...</Typography>
      </Backdrop>
      
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>

    </Box>
  );
}