"use client";

import { useEffect, useState } from 'react';
import { AssetsService } from '../../services/assets';
import { MimirService } from '../../services/mimir';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import CircularProgress from '@mui/material/CircularProgress';
import Chip from '@mui/material/Chip';
import Modal from '@mui/material/Modal';
import Lightbulb from '@mui/icons-material/Lightbulb';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import Collapse from '@mui/material/Collapse';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import { getUrl } from 'aws-amplify/storage';
import { styled, keyframes } from '@mui/material/styles';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer
} from 'recharts';
import TuneIcon from '@mui/icons-material/Tune';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { vars, modelSupportsTemperature } from '../../amplify/global-variables';

interface TimelineEvent {
  name: string;
  timestamp: number;
  frame: string;
  flags: Array<Record<string, string>>;
}

interface ComplianceFlag {
  name: string;
  detected: boolean;
  description: string;
  confidence: number;
}

interface TimelineAnalysisDashboardProps {
  s3Id: string;
  onTimestampClick?: (timestamp: number) => void;
  showLoadingEllipsis?: boolean;
  frameAnalysisParams?: {
    frameAnalysisBedrockModelId?: string;
    frameAnalysisInferenceMaxTokens?: number;
    frameAnalysisInferenceTemperature?: number;
    frameAnalysisInferenceTopK?: number;
    frameAnalysisInferenceTopP?: number;
  };
  frameAnalysisFPS?: number;
  mimirItemId?: string;
}

const getSeverityColor = (confidence: number) => {
  if (confidence >= 90) return '#f44336';
  if (confidence >= 75) return '#ff9800';
  if (confidence >= 50) return '#ffeb3b';
  return '#4caf50';
};

const gearSpinAnimation = keyframes`
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
`;

const ProcessingIndicator = styled(Box)(() => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '12px',
  '& .gear': {
    width: '32px',
    height: '32px',
    animation: `${gearSpinAnimation} 3s linear infinite`,
  },
}));

const getFlagColor = (flagType: string) => {
  const colors = [
    'rgba(0, 188, 212, 0.9)',
    'rgba(138, 43, 226, 0.9)',
    'rgba(33, 150, 243, 0.7)',
    'rgba(63, 81, 181, 0.7)',
    'rgba(0, 188, 212, 0.4)',
    'rgba(138, 43, 226, 0.4)'
  ];
  const hash = flagType.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);
  return colors[Math.abs(hash) % colors.length];
};

export default function TimelineAnalysisDashboard({ s3Id, onTimestampClick, showLoadingEllipsis = false, frameAnalysisParams, frameAnalysisFPS, mimirItemId }: TimelineAnalysisDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalImage, setModalImage] = useState<{ url: string; timestamp: string } | null>(null);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [mimirPushing, setMimirPushing] = useState(false);
  const [mimirSnackbar, setMimirSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({ open: false, message: '', severity: 'info' });

  // Utility function to get model display name from model ID
  const getModelDisplayName = (modelId: string): string => {
    const model = vars.BEDROCK_MODELS.find(m => m.id === modelId);
    return model?.name || modelId;
  };

  const handlePushToMimir = async (timelineEvents: TimelineEvent[]) => {
    if (!timelineEvents.length) {
      setMimirSnackbar({ open: true, message: 'No timeline events to push', severity: 'error' });
      return;
    }

    if (!mimirItemId) {
      setMimirSnackbar({ open: true, message: 'No Mimir Item ID available — this asset was not ingested from Mimir', severity: 'error' });
      return;
    }

    setMimirPushing(true);
    try {
      const result = await MimirService.pushToMimir(timelineEvents, s3Id, { itemId: mimirItemId });
      if (result.success) {
        setMimirSnackbar({ open: true, message: `Pushed ${result.totalItems} compliance items to Mimir`, severity: 'success' });
      } else {
        setMimirSnackbar({ open: true, message: result.error || 'Failed to push to Mimir', severity: 'error' });
      }
    } catch (err: any) {
      console.error('Error pushing to Mimir:', err);
      setMimirSnackbar({ open: true, message: err.message || 'Failed to push to Mimir', severity: 'error' });
    } finally {
      setMimirPushing(false);
    }
  };

  useEffect(() => {
    if (!s3Id) return;

    const fetchAnalysisData = async () => {
      try {
        const data = await AssetsService.getDetailedAnalysis(s3Id);
        if (data && data.sections) {
          setAnalysisData(data);
          setLoading(false);
          return true;
        }
        return false;
      } catch (err) {
        console.error('Error fetching detailed analysis:', err);
        return false;
      }
    };

    fetchAnalysisData();

    const intervalId = setInterval(fetchAnalysisData, 30000);

    return () => {
      clearInterval(intervalId);
    };
  }, [s3Id]);

  if (loading) {
    return (
      <Box sx={{ textAlign: 'center', py: 8, color: 'rgba(255, 255, 255, 0.6)' }}>
        <ProcessingIndicator>
          <svg className="gear" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.22,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.22,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.68 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z" />
          </svg>
          <Typography variant="body1">
            Frame analysis has not started yet. Results will display once complete.
          </Typography>
        </ProcessingIndicator>
      </Box>
    );
  }

  if (error || !analysisData) {
    return (
      <Box sx={{ textAlign: 'center', py: 8, color: 'rgba(255, 255, 255, 0.6)' }}>
        {error ? (
          <Typography variant="body1">
            {error}
          </Typography>
        ) : (
          <ProcessingIndicator>
            <svg className="gear" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.22,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.22,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.68 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z" />
            </svg>
            <Typography variant="body1">
              No results
            </Typography>
          </ProcessingIndicator>
        )}
      </Box>
    );
  }

  const flagsSection = analysisData.sections?.find((s: any) => s.name === 'Detailed Analysis Flags');
  const timelineSection = analysisData.sections?.find((s: any) => s.name === 'Timeline');

  // Calculate dynamic bucket size based on video length
  const timelineEvents = timelineSection?.subsections as TimelineEvent[] || [];
  const maxTimestamp = timelineEvents.length > 0 ? Math.max(...timelineEvents.map(e => e.timestamp)) : 0;
  const targetBuckets = 20; // Aim for ~20 buckets for good chart readability
  const bucketSize = Math.max(10, Math.ceil(maxTimestamp / targetBuckets / 10) * 10); // Min 10s, rounded to 10s

  // Process real timeline data for charts
  const processTimelineData = () => {
    if (!timelineSection?.subsections) return { stackedData: [], flagData: [], confidenceData: [] };
    
    const flagCounts: Record<string, number> = {};
    const flagConfidences: Record<string, number[]> = {};
    
    const buckets: Record<number, Record<string, number>> = {};
    
    timelineEvents.forEach(event => {
      const timeBucket = Math.floor(event.timestamp / bucketSize) * bucketSize;
      
      if (!buckets[timeBucket]) {
        buckets[timeBucket] = {};
      }
      
      event.flags?.forEach(flag => {
        const flagName = Object.keys(flag)[0];
        const confidence = parseFloat(Object.values(flag)[0] as string) || 0;
        
        // Count flags for distribution
        flagCounts[flagName] = (flagCounts[flagName] || 0) + 1;
        
        // Collect confidences
        if (!flagConfidences[flagName]) flagConfidences[flagName] = [];
        flagConfidences[flagName].push(confidence);
        
        // Add to time bucket
        buckets[timeBucket][flagName] = (buckets[timeBucket][flagName] || 0) + 1;
      });
    });
    
    // Create stacked bar data
    const stackedData = Object.keys(buckets)
      .sort((a, b) => parseInt(a) - parseInt(b))
      .map(time => ({
        time: parseInt(time),
        ...buckets[parseInt(time)]
      }));
    
    // Create flag distribution data
    const flagData = Object.entries(flagCounts).map(([name, count]) => ({
      name,
      value: count,
      color: getFlagColor(name)
    }));
    
    // Create confidence data
    const confidenceData = Object.entries(flagConfidences).map(([name, confidences]) => ({
      name,
      confidence: Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length),
      fill: getFlagColor(name)
    }));
    
    return { stackedData, flagData, confidenceData };
  };
  
  const { stackedData, flagData, confidenceData } = processTimelineData();
  
  // Get unique flag types for stacked bars
  const flagTypes = Array.from(new Set(
    stackedData.flatMap(item => Object.keys(item).filter(key => key !== 'time'))
  ));
  
  // Format seconds to MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Powered by section */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mb: 2 }}>
        <Box sx={{ textAlign: 'right' }}>
          <Typography sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '14px' }}>
            Timeline analysis powered by
          </Typography>
          <Typography sx={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '18px', fontWeight: 'bold' }}>
            {frameAnalysisParams?.frameAnalysisBedrockModelId ? 
              getModelDisplayName(frameAnalysisParams.frameAnalysisBedrockModelId) : 
              'Amazon Bedrock'
            }
          </Typography>
        </Box>
        {frameAnalysisParams && (
          <Tooltip title="View inference parameters">
            <IconButton
              onClick={() => setSettingsModalOpen(true)}
              sx={{ 
                ml: 1,
                color: 'rgba(255, 255, 255, 0.6)',
                '&:hover': {
                  color: 'white',
                  backgroundColor: 'rgba(138, 43, 226, 0.1)',
                }
              }}
            >
              <TuneIcon />
            </IconButton>
          </Tooltip>
        )}
      </Box>
      {flagsSection && (
        <Paper sx={{ p: 3, mb: 3, bgcolor: 'rgba(0,0,0,0.4)' }}>
          <Typography variant="h6" sx={{ mb: 3, color: 'white', fontWeight: 'bold' }}>
            Content Compliance Summary
          </Typography>
          {(!flagsSection.subsections || flagsSection.subsections.length === 0) ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <CheckCircleOutlineIcon sx={{ fontSize: 48, color: '#4caf50', mb: 1 }} />
              <Typography sx={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '16px' }}>
                No content compliance flags were detected in the analyzed frames.
              </Typography>
            </Box>
          ) : (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            {flagsSection.subsections?.map((flag: ComplianceFlag, index: number) => (
              <Box
                key={index}
                sx={{
                  flex: '1 1 300px',
                  minWidth: '300px',
                  background: 'linear-gradient(135deg, rgba(0, 188, 212, 0.1) 0%, rgba(138, 43, 226, 0.1) 100%)',
                  borderRadius: 4,
                  p: 3,
                  backdropFilter: 'blur(15px)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  position: 'relative',
                  overflow: 'hidden',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '2px',
                    background: 'linear-gradient(90deg, #00bcd4, #8a2be2)'
                  }
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                  <Chip
                    label={flag.name}
                    sx={{
                      bgcolor: 'rgba(138, 43, 226, 0.3)',
                      color: 'white',
                      fontWeight: 'bold'
                    }}
                  />
                  <Chip
                    label={`${flag.confidence}%`}
                    size="small"
                    sx={{
                      bgcolor: getSeverityColor(flag.confidence),
                      color: 'black',
                      fontWeight: 'bold'
                    }}
                  />
                </Box>
                <Typography sx={{ color: 'rgba(255,255,255,0.9)', fontSize: '14px' }}>
                  {flag.description}
                </Typography>
              </Box>
            ))}
          </Box>
          )}
        </Paper>
      )}

      {/* Timeline Flag Report */}
      {timelineSection && (timelineSection.subsections?.length > 0 ? (
        <>
        <Paper sx={{ p: 3, mb: 3, bgcolor: 'rgba(0,0,0,0.4)', width: '100%' }}>
          <Typography variant="h6" sx={{ mb: 3, color: 'white', fontWeight: 'bold' }}>
            Timeline Flag Report
          </Typography>
          <Box sx={{ width: '100%' }}>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={stackedData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis 
                  dataKey="time" 
                  tick={{ fill: 'white', fontSize: 12 }} 
                  tickFormatter={formatTime}
                />
                <YAxis 
                  tick={{ fill: 'white', fontSize: 12 }} 
                  label={{ value: 'Flag Count', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: 'white', fontSize: 12 } }} 
                />
                <RechartsTooltip 
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const timeValue = typeof label === 'number' ? label : parseInt(String(label)) || 0;
                      return (
                        <Box sx={{ bgcolor: 'rgba(0,0,0,0.8)', p: 1, borderRadius: 1, border: '1px solid rgba(255,255,255,0.2)' }}>
                          <Typography sx={{ color: 'white', fontSize: '12px', mb: 0.5 }}>
                            Time: {formatTime(timeValue)}-{formatTime(timeValue + bucketSize)}
                          </Typography>
                          {payload.map((entry: any, index: number) => (
                            <Typography key={index} sx={{ color: entry.color, fontSize: '12px' }}>
                              {entry.name}: {entry.value}
                            </Typography>
                          ))}
                        </Box>
                      );
                    }
                    return null;
                  }}
                  cursor={false}
                />
                <Legend wrapperStyle={{ color: 'white' }} verticalAlign="top" height={36} />
                {flagTypes.map((flagType) => (
                  <Bar 
                    key={flagType} 
                    dataKey={flagType} 
                    stackId="flags" 
                    fill={getFlagColor(flagType)}
                    name={flagType}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </Paper>

        <Paper sx={{ p: 3, bgcolor: 'rgba(0,0,0,0.4)' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
            <Typography variant="h6" sx={{ color: 'white', fontWeight: 'bold' }}>
              Timeline Events ({frameAnalysisFPS || 'Unknown'} FPS)
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {mimirItemId && (
                <Tooltip title="Push compliance timeline data to Mimir">
                  <span>
                    <Button
                      variant="outlined"
                      size="small"
                      disabled={mimirPushing}
                      onClick={() => handlePushToMimir(timelineEvents)}
                      sx={{
                        borderColor: '#8a2be2',
                        color: 'white',
                        fontSize: '12px',
                        '&:hover': {
                          borderColor: '#7a1fd2',
                          backgroundColor: 'rgba(138, 43, 226, 0.1)',
                        },
                      }}
                    >
                      {mimirPushing ? (
                        <CircularProgress size={14} sx={{ color: 'white', mr: 1 }} />
                      ) : null}
                      {mimirPushing ? 'Pushing...' : 'Push to Mimir'}
                    </Button>
                  </span>
                </Tooltip>
              )}
              <Lightbulb sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '20px' }} />
              <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '16px', fontStyle: 'italic' }}>
                Click timestamps to navigate to video position
              </Typography>
            </Box>
          </Box>
          <GroupedTimelineEvents 
            events={timelineSection.subsections || []}
            s3Id={s3Id}
            onImageClick={(url, timestamp) => {
              setModalImage({ url, timestamp });
              setModalOpen(true);
            }}
            onTimestampClick={onTimestampClick}
          />
        </Paper>
        </>
      ) : (
        <Paper sx={{ p: 3, mb: 3, bgcolor: 'rgba(0,0,0,0.4)' }}>
          <Typography variant="h6" sx={{ mb: 3, color: 'white', fontWeight: 'bold' }}>
            Timeline Flag Report
          </Typography>
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <CheckCircleOutlineIcon sx={{ fontSize: 48, color: '#4caf50', mb: 1 }} />
            <Typography sx={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '16px' }}>
              No timeline events were flagged. All analyzed frames passed content moderation checks.
            </Typography>
          </Box>
        </Paper>
      ))}
      
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <Box
          sx={{
            position: 'relative',
            maxWidth: '90vw',
            maxHeight: '90vh',
            bgcolor: 'rgba(26, 26, 46, 0.95)',
            borderRadius: 3,
            p: 3,
            border: '1px solid rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(20px)',
            outline: 'none'
          }}
        >
          {modalImage && (
            <>
              <Typography sx={{ color: 'white', mb: 2, textAlign: 'center', fontWeight: 'bold' }}>
                Frame at {modalImage.timestamp}
              </Typography>
              <img
                src={modalImage.url}
                alt={`Frame at ${modalImage.timestamp}`}
                style={{
                  width: '100%',
                  height: 'auto',
                  maxHeight: '70vh',
                  objectFit: 'contain',
                  borderRadius: '8px'
                }}
              />
            </>
          )}
        </Box>
      </Modal>
      
      {/* Settings Modal */}
      <Modal
        open={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <Box
          sx={{
            position: 'relative',
            maxWidth: '500px',
            width: '90vw',
            bgcolor: 'rgba(26, 26, 46, 0.95)',
            borderRadius: 3,
            p: 3,
            border: '1px solid rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(20px)',
            outline: 'none'
          }}
        >
          <Typography variant="h6" sx={{ color: 'white', mb: 2, fontWeight: 'bold' }}>
            Frame Analysis Inference Parameters
          </Typography>
          
          <Box sx={{ 
            p: 3, 
            bgcolor: 'rgba(0,0,0,0.3)', 
            borderRadius: 2,
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            <Box sx={{ mb: 2 }}>
              <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px' }}>
                Model
              </Typography>
              <Typography sx={{ color: 'white', fontSize: '14px', fontWeight: 'bold' }}>
                {frameAnalysisParams?.frameAnalysisBedrockModelId ? 
                  getModelDisplayName(frameAnalysisParams.frameAnalysisBedrockModelId) : 
                  'Default'
                }
              </Typography>
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 2 }}>
              <Box>
                <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px' }}>
                  Max Tokens
                </Typography>
                <Typography sx={{ color: 'white', fontSize: '14px' }}>
                  {frameAnalysisParams?.frameAnalysisInferenceMaxTokens ? 
                    frameAnalysisParams.frameAnalysisInferenceMaxTokens.toLocaleString() : 
                    'Default'
                  }
                </Typography>
              </Box>
              <Box>
                <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px' }}>
                  Temperature
                </Typography>
                <Typography sx={{ color: 'white', fontSize: '14px' }}>
                  {modelSupportsTemperature(frameAnalysisParams?.frameAnalysisBedrockModelId)
                    ? (frameAnalysisParams?.frameAnalysisInferenceTemperature || 'Default')
                    : 'Default'}
                </Typography>
              </Box>
              <Box>
                <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px' }}>
                  Top P
                </Typography>
                <Typography sx={{ color: 'white', fontSize: '14px' }}>
                  {frameAnalysisParams?.frameAnalysisInferenceTopP || 'Default'}
                </Typography>
              </Box>
              <Box>
                <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px' }}>
                  Top K
                </Typography>
                <Typography sx={{ color: 'white', fontSize: '14px' }}>
                  {frameAnalysisParams?.frameAnalysisInferenceTopK || 'Default'}
                </Typography>
              </Box>
            </Box>
          </Box>
          
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
            <Button
              onClick={() => setSettingsModalOpen(false)}
              sx={{
                color: 'white',
                borderColor: 'rgba(255, 255, 255, 0.3)',
                '&:hover': {
                  borderColor: 'white',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                }
              }}
              variant="outlined"
            >
              Close
            </Button>
          </Box>
        </Box>
      </Modal>
      
      {/* Mimir push feedback */}
      <Snackbar
        open={mimirSnackbar.open}
        autoHideDuration={6000}
        onClose={() => setMimirSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setMimirSnackbar(prev => ({ ...prev, open: false }))}
          severity={mimirSnackbar.severity}
          sx={{ width: '100%' }}
        >
          {mimirSnackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

interface GroupedTimelineEventsProps {
  events: TimelineEvent[];
  s3Id: string;
  onImageClick: (url: string, timestamp: string) => void;
  onTimestampClick?: (timestamp: number) => void;
}

function GroupedTimelineEvents({ events, s3Id, onImageClick, onTimestampClick }: GroupedTimelineEventsProps) {
  const [expandedMinutes, setExpandedMinutes] = useState<Set<number>>(new Set());

  // Group events by minute
  const groupedEvents = events.reduce((acc, event) => {
    const minute = Math.floor(event.timestamp / 60);
    if (!acc[minute]) {
      acc[minute] = [];
    }
    acc[minute].push(event);
    return acc;
  }, {} as Record<number, TimelineEvent[]>);

  const toggleMinute = (minute: number) => {
    const newExpanded = new Set(expandedMinutes);
    if (newExpanded.has(minute)) {
      newExpanded.delete(minute);
    } else {
      newExpanded.add(minute);
    }
    setExpandedMinutes(newExpanded);
  };

  const formatMinuteRange = (minute: number) => {
    const startTime = minute * 60;
    const endTime = (minute + 1) * 60 - 1;
    const formatTime = (seconds: number) => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    };
    return `${formatTime(startTime)} - ${formatTime(endTime)}`;
  };

  const getMinuteSummary = (events: TimelineEvent[]) => {
    const flagTypes = new Set<string>();
    events.forEach(event => {
      event.flags?.forEach(flag => {
        flagTypes.add(Object.keys(flag)[0]);
      });
    });
    return Array.from(flagTypes);
  };

  return (
    <Box sx={{ position: 'relative' }}>
      <Box
        sx={{
          position: 'absolute',
          left: '16px',
          top: 0,
          bottom: 0,
          width: '8px',
          bgcolor: 'rgba(255, 255, 255, 0.7)',
          borderRadius: '4px',
          zIndex: 1
        }}
      />
      
      {Object.entries(groupedEvents)
        .sort(([a], [b]) => parseInt(a) - parseInt(b))
        .map(([minute, minuteEvents]) => {
          const minuteNum = parseInt(minute);
          const isExpanded = expandedMinutes.has(minuteNum);
          const flagSummary = getMinuteSummary(minuteEvents);
          
          return (
            <Box key={minute} sx={{ mb: 2 }}>
              {/* Minute Header */}
              <Box sx={{ display: 'flex', mb: 2, position: 'relative' }}>
                <Box
                  sx={{
                    position: 'absolute',
                    left: '8px',
                    top: '12px',
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    bgcolor: '#8a2be2',
                    border: '3px solid rgba(26, 26, 46, 1)',
                    zIndex: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <AccessTimeIcon sx={{ color: 'white', fontSize: '14px' }} />
                </Box>
                
                <Box sx={{ ml: 6, flex: 1 }}>
                  <Paper 
                    sx={{ 
                      p: 2, 
                      bgcolor: 'rgba(138, 43, 226, 0.1)', 
                      border: '1px solid rgba(138, 43, 226, 0.3)',
                      borderRadius: 2,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        bgcolor: 'rgba(138, 43, 226, 0.2)',
                        borderColor: 'rgba(138, 43, 226, 0.5)'
                      }
                    }}
                    onClick={() => toggleMinute(minuteNum)}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Typography sx={{ color: 'white', fontWeight: 'bold', fontSize: '16px' }}>
                          Minute {minuteNum + 1}
                        </Typography>
                        <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px' }}>
                          {formatMinuteRange(minuteNum)}
                        </Typography>
                        <Chip 
                          label={`${minuteEvents.length} event${minuteEvents.length !== 1 ? 's' : ''}`}
                          size="small"
                          sx={{
                            bgcolor: 'rgba(255,255,255,0.2)',
                            color: 'white',
                            fontSize: '12px'
                          }}
                        />
                      </Box>
                      <IconButton 
                        sx={{ color: 'white' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleMinute(minuteNum);
                        }}
                      >
                        {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      </IconButton>
                    </Box>
                    
                    {/* Flag Summary */}
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                      {flagSummary.slice(0, 5).map((flagType, index) => (
                        <Chip
                          key={index}
                          label={flagType}
                          size="small"
                          sx={{
                            bgcolor: 'rgba(255,255,255,0.1)',
                            color: 'rgba(255,255,255,0.8)',
                            fontSize: '11px',
                            height: '20px'
                          }}
                        />
                      ))}
                      {flagSummary.length > 5 && (
                        <Chip
                          label={`+${flagSummary.length - 5} more`}
                          size="small"
                          sx={{
                            bgcolor: 'rgba(255,255,255,0.1)',
                            color: 'rgba(255,255,255,0.6)',
                            fontSize: '11px',
                            height: '20px'
                          }}
                        />
                      )}
                    </Box>
                  </Paper>
                </Box>
              </Box>
              
              {/* Expanded Events */}
              <Collapse in={isExpanded}>
                <Box sx={{ ml: 6, pl: 2, borderLeft: '2px solid rgba(138, 43, 226, 0.3)' }}>
                  {minuteEvents.map((event, index) => (
                    <TimelineEventCard 
                      key={index}
                      event={event}
                      s3Id={s3Id}
                      onImageClick={onImageClick}
                      onTimestampClick={onTimestampClick}
                      isNested={true}
                    />
                  ))}
                </Box>
              </Collapse>
            </Box>
          );
        })}
    </Box>
  );
}

interface TimelineEventCardProps {
  event: TimelineEvent;
  s3Id: string;
  onImageClick: (url: string, timestamp: string) => void;
  onTimestampClick?: (timestamp: number) => void;
  isNested?: boolean;
}

function TimelineEventCard({ event, s3Id, onImageClick, onTimestampClick, isNested = false }: TimelineEventCardProps) {
  const [frameUrl, setFrameUrl] = useState<string>('');

  useEffect(() => {
    const getFrameUrl = async () => {
      if (!event.frame || !s3Id) return;
      try {
        const s3IdWithoutExtension = s3Id.split('.')[0];
        const frameFilename = event.frame.split('/').pop();
        
        const url = await getUrl({
          path: ({identityId}) => `processed/video/${identityId}/${s3IdWithoutExtension}/thumbnails/${frameFilename}`,
          options: {
            validateObjectExistence: true,
            expiresIn: 86400,
          }
        });
        
        setFrameUrl(url.url.toString());
      } catch (error) {
        console.error('Error getting frame URL:', error);
      }
    };

    getFrameUrl();
  }, [event.frame, s3Id]);

  return (
    <Box sx={{ display: 'flex', mb: isNested ? 2 : 3, position: 'relative' }}>
      {!isNested && (
        <Box
          sx={{
            position: 'absolute',
            left: '8px',
            top: '1px',
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            bgcolor: 'white',
            border: '3px solid rgba(26, 26, 46, 1)',
            zIndex: 2
          }}
        />
      )}
      
      <Box sx={{ ml: isNested ? 0 : 6, flex: 1 }}>
        <Box sx={{ 
          display: 'flex', 
          gap: 3, 
          alignItems: 'flex-start',
          p: isNested ? 2 : 0,
          bgcolor: isNested ? 'rgba(0,0,0,0.2)' : 'transparent',
          borderRadius: isNested ? 1 : 0,
          border: isNested ? '1px solid rgba(255,255,255,0.1)' : 'none'
        }}>
          <Box sx={{ flex: isNested ? '0 0 150px' : '0 0 200px' }}>
            <Typography 
              sx={{ 
                color: 'white', 
                fontWeight: 'bold', 
                mb: 1,
                fontSize: isNested ? '14px' : '16px',
                cursor: onTimestampClick ? 'pointer' : 'default',
                '&:hover': onTimestampClick ? {
                  color: '#8a2be2',
                  textDecoration: 'underline'
                } : {}
              }}
              onClick={() => onTimestampClick?.(event.timestamp)}
            >
              {event.name}
            </Typography>
            {frameUrl && (
              <img
                src={frameUrl}
                alt={`Frame at ${event.name}`}
                onClick={() => onImageClick(frameUrl, event.name)}
                style={{
                  width: '100%',
                  height: 'auto',
                  borderRadius: '4px',
                  border: '1px solid rgba(255,255,255,0.2)',
                  cursor: 'pointer',
                  transition: 'transform 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = isNested ? 'scale(1.01)' : 'scale(1.02)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              />
            )}
          </Box>
          
          <Box sx={{ flex: 1, pt: isNested ? 0 : 1 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, pt: isNested ? 1 : 3 }}>
              {event.flags?.map((flagObj, flagIndex) => {
                const flagType = Object.keys(flagObj)[0];
                const flagDescription = flagObj[flagType];
                
                return (
                  <Box
                    key={flagIndex}
                    sx={{
                      p: isNested ? 1.5 : 2,
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 1,
                      bgcolor: isNested ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.2)'
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Chip
                        label={flagType}
                        size="small"
                        sx={{
                          bgcolor: 'rgba(138, 43, 226, 0.3)',
                          color: 'white',
                          fontSize: '12px'
                        }}
                      />
                    </Box>
                    <Typography sx={{ color: 'rgba(255,255,255,0.9)', fontSize: isNested ? '13px' : '14px' }}>
                      {flagDescription}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}