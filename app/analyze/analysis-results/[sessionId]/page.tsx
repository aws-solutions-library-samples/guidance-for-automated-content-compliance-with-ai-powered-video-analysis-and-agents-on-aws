"use client";

import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { VideoAnalysisService } from '../../../../services/video-analysis';
import { StatisticsService } from '../../../../services/statistics';
import { AssetsService } from '../../../../services/assets';
import { IVideoAnalysisHistoryResult } from '../../../../types/video-analysis';
import { IStatistic } from '../../../../types/statistic';
import { useSelector } from 'react-redux';
import { IUserStateReducer } from '@/store/auth';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import CircularProgress from '@mui/material/CircularProgress';
import LinearProgress from '@mui/material/LinearProgress';
import Alert from '@mui/material/Alert';
import Backdrop from '@mui/material/Backdrop';
import Button from '@mui/material/Button';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AttachMoneyOutlined from '@mui/icons-material/AttachMoneyOutlined';
import AccessTimeOutlined from '@mui/icons-material/AccessTimeOutlined';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import IconButton from '@mui/material/IconButton';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import Tooltip from '@mui/material/Tooltip';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Snackbar from '@mui/material/Snackbar';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Modal from '@mui/material/Modal';
import SecurityIcon from '@mui/icons-material/Security';
import SummarizeIcon from '@mui/icons-material/Summarize';
import TimelineIcon from '@mui/icons-material/Timeline';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import VideoPlayer, { VideoPlayerRef } from '../../../../components/video-player/video-player';
import TimelineAnalysisDashboard from '../../../../components/timeline-analysis-dashboard/timeline-analysis-dashboard';
import { BedrockModelIds, vars } from '../../../../amplify/global-variables';
import TuneIcon from '@mui/icons-material/Tune';



// Utility function to get model display name from model ID
const getModelDisplayName = (modelId: string): string => {
  const model = vars.BEDROCK_MODELS.find(m => m.id === modelId);
  return model?.name || modelId;
};

export default function AnalysisResultsPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  const [analysisResult, setAnalysisResult] = useState<IVideoAnalysisHistoryResult | null>(null);
  const [statistics, setStatistics] = useState<IStatistic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [transcript, setTranscript] = useState<string>('');
  const [parsedAnalysis, setParsedAnalysis] = useState<any>(null);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [complianceExpanded, setComplianceExpanded] = useState(true);
  const [videoPlayerExpanded, setVideoPlayerExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const searchParams = useSearchParams();

  
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam) {
      const tabIndex = parseInt(tabParam, 10);
      if (tabIndex >= 0 && tabIndex <= 3) {
        setActiveTab(tabIndex);
      }
    }
  }, [searchParams]);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const videoPlayerRef = useRef<VideoPlayerRef>(null);
  
  const authState = useSelector((state: IUserStateReducer) => state.authReducer);

  useEffect(() => {
    const fetchAnalysisResult = async () => {
      if (!sessionId || !authState.user?.identityId) return;
      
      try {
        setLoading(true);
        const result = await VideoAnalysisService.getVideoAnalysisByJobId(sessionId);
        setAnalysisResult(result);
        setIsBookmarked(result.bookmark);
        
        // Parse JSON analysis result
        try {
          const parsed = JSON.parse(result.resultRaw);
          setParsedAnalysis(parsed);
        } catch (e) {
          console.log('Could not parse analysis result as JSON, showing raw text');
        }

        const s3Id = result.s3VideoObjectKey?.split('/').pop() as string;

        // Fetch transcript if available
        if (result.s3TranscriptObjectKey) {
          AssetsService.getTranscript(result.s3TranscriptObjectKey)
            .then(setTranscript)
            .catch(console.error);
        }

      } catch (err: any) {
        console.error('Error fetching analysis result:', err);
        const errorMessage = err?.errors?.[0]?.message || err?.message || 'Failed to load analysis results';
        setError(errorMessage);
        setSnackbarOpen(true);
      } finally {
        setLoading(false);
      }
    };

    const fetchStatistics = () => {
      if (!sessionId) return;
      
      StatisticsService.getStatisticsBySessionId(sessionId)
        .then((statisticsResult) => {
          setStatistics(statisticsResult);
        })
        .catch((err: any) => {
          console.error('Error fetching statistics:', err);
          const errorMessage = err?.errors?.[0]?.message || err?.message || 'Failed to load pricing statistics';
          setError(errorMessage);
          setSnackbarOpen(true);
        });
    };

    fetchAnalysisResult();
    fetchStatistics();
  }, [sessionId, authState.user?.identityId]);

  // Polling effect for frame analysis progress
  useEffect(() => {
    if (!analysisResult || !sessionId || !authState.user?.identityId) return;
    
    const isComplete = analysisResult.framesAnalysed != null && analysisResult.framesToAnalyse != null && 
                      analysisResult.framesAnalysed === analysisResult.framesToAnalyse;
    
    if (!isComplete) {
      const pollInterval = setInterval(async () => {
        try {
          const updatedResult = await VideoAnalysisService.getVideoAnalysisByJobId(sessionId);
          const wasComplete = analysisResult.framesAnalysed != null && analysisResult.framesToAnalyse != null && 
                             analysisResult.framesAnalysed === analysisResult.framesToAnalyse;
          const nowComplete = updatedResult.framesAnalysed != null && updatedResult.framesToAnalyse != null && 
                             updatedResult.framesAnalysed === updatedResult.framesToAnalyse;
          
          setAnalysisResult(updatedResult);
          
          // If frame analysis just completed, refresh all data
          if (!wasComplete && nowComplete) {
            const [statisticsResult] = await Promise.all([
              StatisticsService.getStatisticsBySessionId(sessionId)
            ]);
            setStatistics(statisticsResult);
          }
        } catch (error) {
          console.error('Error polling video analysis:', error);
        }
      }, 10000);
      
      return () => clearInterval(pollInterval);
    }
  }, [sessionId, authState.user?.identityId, analysisResult?.framesAnalysed, analysisResult?.framesToAnalyse]);

  if (loading) {
    return (
      <Backdrop open={loading} sx={{ zIndex: 9999, flexDirection: 'column', gap: 2 }}>
        <CircularProgress color="inherit" />
        <Typography color="inherit" variant="h6">Loading Analysis...</Typography>
      </Backdrop>
    );
  }

  if (!analysisResult) {
    return (
      <Box sx={{ maxWidth: 800, margin: '40px auto', p: 3 }}>
        <Alert severity="info">No analysis results found for this session.</Alert>
      </Box>
    );
  }

  const processingTypeBreakdown = statistics.reduce((acc, stat) => {
    const type = stat.processingType || 'Unknown';
    if (!acc[type]) {
      acc[type] = {
        inputTokens: 0,
        outputTokens: 0,
        inputTokenCost: 0,
        outputTokenCost: 0,
        processingTime: 0,
        duration: 0,
        count: 0
      };
    }
    acc[type].inputTokens += stat.inputTokens || 0;
    acc[type].outputTokens += stat.outputTokens || 0;
    acc[type].inputTokenCost += stat.inputTokenCost || 0;
    acc[type].outputTokenCost += stat.outputTokenCost || 0;
    acc[type].processingTime += stat.processingTime || 0;
    acc[type].duration += stat.duration || 0;
    acc[type].count += 1;
    return acc;
  }, {} as Record<string, {
    inputTokens: number;
    outputTokens: number;
    inputTokenCost: number;
    outputTokenCost: number;
    processingTime: number;
    duration: number;
    count: number;
  }>);

  // Calculate optional analysis costs and processing time
  const optionalTypes = ['Agent', 'Profanity'];
  const optionalCost = optionalTypes.reduce((sum, type) => {
    const data = processingTypeBreakdown[type] || { inputTokenCost: 0, outputTokenCost: 0 };
    return sum + data.inputTokenCost + data.outputTokenCost;
  }, 0);
  const optionalProcessingTime = optionalTypes.reduce((sum, type) => {
    const data = processingTypeBreakdown[type] || { processingTime: 0 };
    return sum + data.processingTime;
  }, 0);
  
  // Calculate totals excluding optional analysis
  const totalCost = statistics.reduce((sum, stat) => sum + (stat.inputTokenCost || 0) + (stat.outputTokenCost || 0), 0) - optionalCost;
  const totalProcessingTime = statistics.reduce((sum, stat) => sum + (stat.processingTime || 0), 0) - optionalProcessingTime;
  
  const formatProcessingTime = (seconds: number) => {
    if (seconds < 60) return `${seconds.toFixed(1)} sec`;
    const minutes = seconds / 60;
    if (minutes < 60) return `${minutes.toFixed(1)} min`;
    const hours = minutes / 60;
    return `${hours.toFixed(1)} hours`;
  };

  const formatCost = (cost: number) => {
    if (cost === 0) return '0.00';
    if (cost < 0.01) return cost.toFixed(4);
    return cost.toFixed(2);
  };

  return (
    <Box sx={{ p: 5 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Button
            variant="contained"
            startIcon={<ArrowBackIcon />}
            onClick={() => window.history.back()}
            sx={{ 
              fontSize: '16px',
              px: 3,
              py: 1.5,
              backgroundColor: '#8a2be2',
              '&:hover': {
                backgroundColor: '#7a1fd2',
              },
              mb: 2
            }}
          >
            Back
          </Button>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="h4" sx={{ fontWeight: 500 }}>
              Analysis Results
            </Typography>
            <Tooltip title={isBookmarked ? "Remove bookmark" : "Add bookmark"}>
              <IconButton
                onClick={async () => {
                  try {
                    const newBookmarkState = !isBookmarked;
                    await VideoAnalysisService.updateVideoAnalysisBookmark(sessionId, newBookmarkState);
                    setIsBookmarked(newBookmarkState);
                  } catch (err) {
                    console.error('Error updating bookmark:', err);
                    setError('Failed to update bookmark');
                    setSnackbarOpen(true);
                  }
                }}
                sx={{ color: isBookmarked ? '#ffd700' : 'rgba(255, 255, 255, 0.5)' }}
              >
                {isBookmarked ? <BookmarkIcon /> : <BookmarkBorderIcon />}
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
        <Paper sx={{ p: 2, bgcolor: 'rgba(26, 26, 46, 0.6)', borderRadius: 2, minWidth: '300px' }}>
          <Typography variant="h6" sx={{ mb: 1, fontSize: '14px' }}>Analysis Information</Typography>
          <Typography sx={{ fontSize: '12px' }}><strong>Session ID:</strong> {analysisResult.sessionId}</Typography>
          <Typography sx={{ fontSize: '12px' }}><strong>S3 ID:</strong> {analysisResult.s3VideoObjectKey?.split('/').pop() || 'N/A'}</Typography>
          <Typography sx={{ fontSize: '12px' }}><strong>Analysis Date:</strong> {new Date(analysisResult.createdAt).toLocaleString()}</Typography>
        </Paper>
      </Box>



      {analysisResult.s3VideoObjectKey && (
        <Paper sx={{ p: 3, bgcolor: 'rgba(26, 26, 46, 0.6)', borderRadius: 2, mb: 3 }} data-video-player>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Video Player: {analysisResult.s3OriginalFilename}</Typography>
            <Tooltip title={videoPlayerExpanded ? "Collapse" : "Expand"}>
              <IconButton
                onClick={() => setVideoPlayerExpanded(!videoPlayerExpanded)}
                sx={{ color: 'white' }}
              >
                {videoPlayerExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </Tooltip>
          </Box>
          
          {videoPlayerExpanded && (
            <VideoPlayer 
              ref={videoPlayerRef}
              s3VideoId={analysisResult.s3VideoObjectKey.split('/').pop() || ''}
              transcript={transcript}
              title={analysisResult.s3OriginalFilename}
            />
          )}
        </Paper>
      )}

      <Paper sx={{ bgcolor: 'rgba(26, 26, 46, 0.6)', borderRadius: 2 }}>
        <Box sx={{
          background: 'linear-gradient(to top, #1a1a1a 0%, #2d1b3d 50%, #8a2be2 100%)',
          borderRadius: '12px 12px 0 0',
        }}>
          <Tabs
            value={activeTab}
            onChange={(_, newValue) => setActiveTab(newValue)}
            centered
            sx={{
              '& .MuiTabs-flexContainer': {
                gap: 1,
                px: 3,
                py: 1,
              },
              '& .MuiTab-root': {
                color: 'rgba(255, 255, 255, 0.6)',
                fontSize: '12px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                minHeight: 48,
                minWidth: 160,
                borderRadius: '8px',
                margin: '4px',
                transition: 'all 0.3s ease',
                flexDirection: 'row',
                gap: 1,
                '&:hover': {
                  color: 'rgba(255, 255, 255, 0.9)',
                  backgroundColor: 'rgba(138, 43, 226, 0.1)',
                },
                '&.Mui-selected': {
                  color: '#ffffff',
                  backgroundColor: 'transparent',
                },
                '& .MuiTab-iconWrapper': {
                  marginBottom: 0,
                  marginRight: '8px',
                  fontSize: '20px',
                },
              },
              '& .MuiTabs-indicator': {
                backgroundColor: '#8a2be2',
                height: 4,
                borderRadius: '2px',
              },
            }}
          >
            <Tab 
              icon={<SecurityIcon />} 
              label="Compliance Analysis"
            />
            <Tab 
              icon={<TimelineIcon />} 
              label="Timeline Report"
            />
            <Tab 
              icon={<VerifiedUserIcon />} 
              label="Validation"
            />
            <Tab 
              icon={<MonetizationOnIcon />} 
              label="Analysis Cost"
            />
          </Tabs>
        </Box>

        {/* Compliance Analysis Tab */}
        {activeTab === 0 && (
          <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mb: 2 }}>
              <Box sx={{ textAlign: 'right' }}>
                <Typography sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '14px' }}>
                  Compliance analysis powered by
                </Typography>
                <Typography sx={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '18px', fontWeight: 'bold' }}>
                  {getModelDisplayName(analysisResult.bedrockModelId)}
                </Typography>
              </Box>
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
            </Box>
            {parsedAnalysis?.sections ? (
          <Box>
            {/* General Rating System, Content Moderation Analysis, and House Rating System Analysis - equal width */}
            <Box sx={{ display: 'flex', gap: 3, mb: 3, alignItems: 'stretch' }}>
              {parsedAnalysis.sections
                .filter((section: any) => 
                  // These section names match up to the json returned from the LLM
                  section.name === 'General Rating System' || 
                  section.name === 'Content Moderation' ||
                  section.name === 'House Rating System'
                )
                .map((section: any, sectionIndex: number) => (
                <Box key={sectionIndex} sx={{ flex: '1 1 33.33%' }}>
                  <Paper sx={{ p: 0, bgcolor: 'rgba(0,0,0,0.4)', height: '100%' }}>
                    <Box sx={{ bgcolor: 'rgba(138, 43, 226, 0.3)', p: 1, mb: 2 }}>
                      <Typography sx={{ color: 'white', fontSize: '14px', textAlign: 'center', fontWeight: 'bold' }}>
                        {section.name}
                      </Typography>
                    </Box>
                    <Box sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      {section.subsections?.map((subsection: any, subsectionIndex: number) => (
                        <Box key={subsectionIndex} sx={{ mb: 2 }}>
                          <Typography sx={{ color: 'white', fontWeight: '500', fontSize: '14px', mb: 1.5, pb: 0.5, textShadow: '2px 1px 2px rgba(0,0,0,0.9)', borderLeft: '3px solid #8a2be2', paddingLeft: '8px', backgroundColor: 'rgba(138, 43, 226, 0.1)' }}>
                            {subsection.name}
                          </Typography>
                          
                          {subsection.value && (
                            <Typography sx={{ color: 'rgba(255,255,255,0.9)', fontSize: '14px', mb: 1 }}>
                              {subsection.value}
                            </Typography>
                          )}
                          
                          {subsection.topics && (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, ml: 1 }}>
                              {(() => {
                                const severityTopic = subsection.topics.find((t: any) => t.name === 'Severity');
                                const descriptionTopic = subsection.topics.find((t: any) => t.name === 'Description');
                                const otherTopics = subsection.topics.filter((t: any) => t.name !== 'Severity' && t.name !== 'Description');
                                
                                return (
                                  <>
                                    {(severityTopic || descriptionTopic) && (
                                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                                        <Box sx={{ width: '75px', display: 'flex', justifyContent: 'flex-start' }}>
                                          {severityTopic && (
                                            <Chip 
                                              label={severityTopic.value} 
                                              size="small" 
                                              sx={{ 
                                                bgcolor: 'rgba(138, 43, 226, 0.3)', 
                                                color: 'white',
                                                fontSize: '12px',
                                                height: '24px'
                                              }} 
                                            />
                                          )}
                                        </Box>
                                        {descriptionTopic && (
                                          <Typography sx={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px', flex: 1 }}>
                                            {descriptionTopic.value}
                                          </Typography>
                                        )}
                                      </Box>
                                    )}
                                    {otherTopics.map((topic: any, topicIndex: number) => (
                                      <Box key={topicIndex} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                                        <Box sx={{ width: '75px', display: 'flex', justifyContent: 'flex-start' }}>
                                          <Chip 
                                            label={topic.name} 
                                            size="small" 
                                            sx={{ 
                                              bgcolor: 'rgba(138, 43, 226, 0.3)', 
                                              color: 'white',
                                              fontSize: '10px',
                                              height: '20px'
                                            }} 
                                          />
                                        </Box>
                                        <Typography sx={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px', flex: 1 }}>
                                          {topic.value}
                                        </Typography>
                                      </Box>
                                    ))}
                                  </>
                                );
                              })()}
                            </Box>
                          )}
                        </Box>
                      ))}
                    </Box>
                    </Box>
                  </Paper>
                </Box>
              ))}
            </Box>
            
            {/* All other sections - flex layout to match 3-card row */}
            <Box sx={{ display: 'flex', gap: 3, alignItems: 'stretch' }}>
              {parsedAnalysis.sections
                .filter((section: any) => 
                  section.name !== 'General Rating System' && 
                  section.name !== 'Content Moderation' &&
                  section.name !== 'House Rating System'
                )
                .map((section: any, sectionIndex: number) => (
                <Box key={sectionIndex} sx={{ 
                  flex: section.name === 'Other' ? 'calc(2 * (50% - 12px) + 14px)' : 'calc(50% - 22px)',
                  minWidth: 0
                }}>
                  <Paper sx={{ p: 0, bgcolor: 'rgba(0,0,0,0.4)', height: '100%' }}>
                    <Box sx={{ bgcolor: 'rgba(138, 43, 226, 0.3)', p: 1, mb: 2 }}>
                      <Typography sx={{ color: 'white', fontSize: '14px', textAlign: 'center', fontWeight: 'bold' }}>
                        {section.name}
                      </Typography>
                    </Box>
                    <Box sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      {section.subsections?.map((subsection: any, subsectionIndex: number) => (
                        <Box key={subsectionIndex} sx={{ mb: 2 }}>
                          <Typography sx={{ color: 'white', fontWeight: '500', fontSize: '14px', mb: 1.5, pb: 0.5, textShadow: '2px 1px 2px rgba(0,0,0,0.9)', borderLeft: '3px solid #8a2be2', paddingLeft: '8px', backgroundColor: 'rgba(138, 43, 226, 0.1)' }}>
                            {subsection.name}
                          </Typography>
                          
                          {subsection.value && (
                            <Typography sx={{ color: 'rgba(255,255,255,0.9)', fontSize: '14px', mb: 1 }}>
                              {subsection.value}
                            </Typography>
                          )}
                          
                          {subsection.topics && (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, ml: 1 }}>
                              {(() => {
                                const severityTopic = subsection.topics.find((t: any) => t.name === 'Severity');
                                const descriptionTopic = subsection.topics.find((t: any) => t.name === 'Description');
                                const otherTopics = subsection.topics.filter((t: any) => t.name !== 'Severity' && t.name !== 'Description');
                                
                                return (
                                  <>
                                    {(severityTopic || descriptionTopic) && (
                                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                                        <Box sx={{ width: '75px', display: 'flex', justifyContent: 'flex-start' }}>
                                          {severityTopic && (
                                            <Chip 
                                              label={severityTopic.value} 
                                              size="small" 
                                              sx={{ 
                                                bgcolor: 'rgba(138, 43, 226, 0.3)', 
                                                color: 'white',
                                                fontSize: '12px',
                                                height: '24px'
                                              }} 
                                            />
                                          )}
                                        </Box>
                                        {descriptionTopic && (
                                          <Typography sx={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px', flex: 1 }}>
                                            {descriptionTopic.value}
                                          </Typography>
                                        )}
                                      </Box>
                                    )}
                                    {otherTopics.map((topic: any, topicIndex: number) => (
                                      <Box key={topicIndex} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                                        <Box sx={{ width: '75px', display: 'flex', justifyContent: 'flex-start' }}>
                                          <Chip 
                                            label={topic.name} 
                                            size="small" 
                                            sx={{ 
                                              bgcolor: 'rgba(138, 43, 226, 0.3)', 
                                              color: 'white',
                                              fontSize: '10px',
                                              height: '20px'
                                            }} 
                                          />
                                        </Box>
                                        <Typography sx={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px', flex: 1 }}>
                                          {topic.value}
                                        </Typography>
                                      </Box>
                                    ))}
                                  </>
                                );
                              })()}
                            </Box>
                          )}
                        </Box>
                      ))}
                    </Box>
                    </Box>
                  </Paper>
                </Box>
              ))}
            </Box>
          </Box>
            ) : (
              <Box sx={{ 
                backgroundColor: 'rgba(0,0,0,0.1)', 
                padding: '16px', 
                borderRadius: '4px', 
                overflow: 'auto',
                maxHeight: '600px'
              }}>
                <pre style={{ 
                  whiteSpace: 'pre-wrap', 
                  fontSize: '14px', 
                  margin: 0,
                  fontFamily: 'inherit'
                }}>
                  {analysisResult.resultRaw}
                </pre>
              </Box>
            )}
          </Box>
        )}

        {/* Timeline Report Tab */}
        {activeTab === 1 && (
          <Box sx={{ p: 3 }}>
            {(() => {
              const progress = analysisResult?.framesAnalysed != null && analysisResult?.framesToAnalyse ? 
                (analysisResult.framesAnalysed / analysisResult.framesToAnalyse) * 100 : 0;
              const showProgress = analysisResult?.framesAnalysed != null && analysisResult?.framesToAnalyse != null && analysisResult.framesAnalysed !== analysisResult.framesToAnalyse;
              const pHashReduction = analysisResult?.totalFrames && analysisResult?.framesToAnalyse ? 
                analysisResult.totalFrames - analysisResult.framesToAnalyse : 0;
              
              console.log('Progress debug:', { totalFrames: analysisResult?.totalFrames, framesToAnalyse: analysisResult?.framesToAnalyse, framesAnalysed: analysisResult?.framesAnalysed, progress, showProgress });
              
              if (showProgress) {
                return (
                  <Box sx={{ textAlign: 'center', py: 12 }}>
                    <Typography variant="h5" sx={{ mb: 4, color: 'white', fontWeight: 600 }}>
                      Frame Analysis Progress
                    </Typography>
                    
                    <Box sx={{ 
                      maxWidth: 600, 
                      mx: 'auto',
                      background: 'linear-gradient(135deg, rgba(138, 43, 226, 0.15) 0%, rgba(0, 188, 212, 0.15) 100%)',
                      borderRadius: 4,
                      p: 4,
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      backdropFilter: 'blur(20px)',
                      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
                    }}>
                      <Box sx={{ mb: 3 }}>
                        <LinearProgress
                          variant="determinate"
                          value={progress}
                          sx={{
                            height: 16,
                            borderRadius: 8,
                            backgroundColor: 'rgba(255, 255, 255, 0.1)',
                            '& .MuiLinearProgress-bar': {
                              borderRadius: 8,
                              background: 'linear-gradient(90deg, #8a2be2, #00bcd4)',
                              boxShadow: '0 0 20px rgba(138, 43, 226, 0.5)'
                            },
                          }}
                        />
                      </Box>
                      
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                        <Typography variant="h6" sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                          {analysisResult.framesAnalysed?.toLocaleString()} / {analysisResult.framesToAnalyse?.toLocaleString()} frames
                        </Typography>
                        <Typography variant="h4" sx={{ color: 'white', fontWeight: 700 }}>
                          {Math.round(progress)}%
                        </Typography>
                      </Box>
                      
                      {pHashReduction > 0 && (
                        <Box sx={{ 
                          mt: 3, 
                          p: 2, 
                          backgroundColor: 'rgba(0, 188, 212, 0.1)', 
                          borderRadius: 2,
                          border: '1px solid rgba(0, 188, 212, 0.3)'
                        }}>
                          <Typography sx={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '14px', textAlign: 'center' }}>
                            pHash optimization reduced analysis by {pHashReduction.toLocaleString()} frames
                          </Typography>
                          <Typography sx={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '13px', textAlign: 'center', mt: 0.5 }}>
                            Total frames: {analysisResult.totalFrames?.toLocaleString()} → Frames to analyze: {analysisResult.framesToAnalyse?.toLocaleString()}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  </Box>
                );
              }
              
              return (
                <TimelineAnalysisDashboard 
                  key={`${analysisResult?.framesAnalysed || 0}-${analysisResult?.framesToAnalyse || 0}`}
                  s3Id={analysisResult?.s3VideoObjectKey?.split('/').pop() || ''} 
                  onTimestampClick={async (timestamp) => {
                    if (!videoPlayerExpanded) {
                      setVideoPlayerExpanded(true);
                      await new Promise(resolve => setTimeout(resolve, 100));
                    }
                    videoPlayerRef.current?.seekTo(timestamp);
                    setTimeout(() => {
                      const videoPlayerElement = document.querySelector('[data-video-player]');
                      if (videoPlayerElement) {
                        videoPlayerElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }
                    }, 100);
                  }}
                  showLoadingEllipsis={!(analysisResult?.framesAnalysed != null && analysisResult?.framesToAnalyse != null && analysisResult.framesAnalysed === analysisResult.framesToAnalyse)}
                  frameAnalysisParams={{
                    frameAnalysisBedrockModelId: analysisResult.frameAnalysisBedrockModelId,
                    frameAnalysisInferenceMaxTokens: analysisResult.frameAnalysisInferenceMaxTokens,
                    frameAnalysisInferenceTemperature: analysisResult.frameAnalysisInferenceTemperature,
                    frameAnalysisInferenceTopK: analysisResult.frameAnalysisInferenceTopK,
                    frameAnalysisInferenceTopP: analysisResult.frameAnalysisInferenceTopP
                  }}
                  frameAnalysisFPS={analysisResult.frameAnalysisFPS}
                  mimirItemId={analysisResult.mimirItemId}
                />
              );
            })()
          }
          </Box>
        )}

        {/* Validation Tab */}
        {activeTab === 2 && (
          <Box sx={{ p: 3 }}>
            {/* Rights Validation Section */}
            {analysisResult.rightsResultRaw ? (() => {
              let rightsData;
              try {
                rightsData = JSON.parse(analysisResult.rightsResultRaw);
                // Ensure data structure exists with safe defaults
                rightsData = {
                  asset_verified: rightsData?.asset_verified || false,
                  filename: rightsData?.filename || 'Unknown',
                  rights_status: {
                    owner: rightsData?.rights_status?.owner || 'Unknown',
                    clearance_status: rightsData?.rights_status?.clearance_status || 'Unknown',
                    expiration_date: rightsData?.rights_status?.expiration_date || null,
                    usage_permissions: Array.isArray(rightsData?.rights_status?.usage_permissions) ? rightsData.rights_status.usage_permissions : [],
                    restrictions: Array.isArray(rightsData?.rights_status?.restrictions) ? rightsData.rights_status.restrictions : [],
                    territory_rights: rightsData?.rights_status?.territory_rights || null
                  },
                  contacts: {
                    primary_contact: rightsData?.contacts?.primary_contact || null,
                    additional_contacts: Array.isArray(rightsData?.contacts?.additional_contacts) ? rightsData.contacts.additional_contacts : []
                  },
                  warnings: Array.isArray(rightsData?.warnings) ? rightsData.warnings : []
                };
              } catch (e) {
                return (
                  <Box sx={{ textAlign: 'center', py: 4, color: 'rgba(255, 255, 255, 0.6)' }}>
                    <Typography>Invalid rights validation data</Typography>
                  </Box>
                );
              }
              
              return (
                <Box sx={{ mb: 6 }}>
                  <Typography variant="h5" sx={{ color: 'white', fontWeight: 600, mb: 3 }}>
                    Rights Validation
                  </Typography>
                  
                  {/* Main Status Header */}
                  <Box sx={{ 
                    display: 'flex', 
                    justifyContent: 'center', 
                    alignItems: 'center', 
                    mb: 4,
                    p: 3,
                    background: rightsData.asset_verified 
                      ? 'linear-gradient(135deg, rgba(76, 175, 80, 0.1) 0%, rgba(138, 43, 226, 0.1) 100%)'
                      : 'linear-gradient(135deg, rgba(244, 67, 54, 0.1) 0%, rgba(138, 43, 226, 0.1) 100%)',
                    borderRadius: 3,
                    border: rightsData.asset_verified 
                      ? '1px solid rgba(76, 175, 80, 0.2)'
                      : '1px solid rgba(244, 67, 54, 0.2)',
                    backdropFilter: 'blur(10px)'
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, textAlign: 'center' }}>
                      <VerifiedUserIcon sx={{ 
                        color: rightsData.asset_verified ? '#4caf50' : '#f44336', 
                        fontSize: 32 
                      }} />
                      <Box>
                        <Typography variant="h4" sx={{ color: 'white', fontWeight: 700, mb: 0.5 }}>
                          {rightsData.asset_verified ? 'Verified' : 'Not Verified'}
                        </Typography>
                        <Typography sx={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '14px' }}>
                          File Name: {rightsData.filename}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>

                  {/* Rights Information Cards */}
                  <Box sx={{ display: 'flex', gap: 3 }}>
                    {/* Rights Status Card */}
                    <Box sx={{ 
                      flex: 1,
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
                    }}>
                      <Typography sx={{ 
                        color: 'rgba(255, 255, 255, 0.9)', 
                        fontSize: '16px', 
                        fontWeight: 700, 
                        letterSpacing: '0.5px',
                        mb: 3
                      }}>
                        Rights Status
                      </Typography>
                      
                      <Box sx={{ mb: 2 }}>
                        <Typography sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '12px', mb: 0.5 }}>
                          Owner
                        </Typography>
                        <Typography sx={{ color: 'white', fontSize: '14px', fontWeight: 600 }}>
                          {rightsData.rights_status?.owner || 'Unknown'}
                        </Typography>
                      </Box>
                      
                      <Box sx={{ mb: 2 }}>
                        <Typography sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '12px', mb: 0.5 }}>
                          Clearance Status
                        </Typography>
                        <Typography sx={{ color: 'white', fontSize: '14px', fontWeight: 600 }}>
                          {rightsData.rights_status?.clearance_status || 'Unknown'}
                        </Typography>
                      </Box>
                      
                      {rightsData.rights_status?.expiration_date && (
                        <Box>
                          <Typography sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '12px', mb: 0.5 }}>
                            Expiration Date
                          </Typography>
                          <Typography sx={{ color: 'white', fontSize: '14px', fontWeight: 600 }}>
                            {rightsData.rights_status.expiration_date}
                          </Typography>
                        </Box>
                      )}
                    </Box>

                    {/* Permissions & Restrictions Card */}
                    <Box sx={{ 
                      flex: 1,
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
                    }}>
                      <Typography sx={{ 
                        color: 'rgba(255, 255, 255, 0.9)', 
                        fontSize: '16px', 
                        fontWeight: 700, 
                        letterSpacing: '0.5px',
                        mb: 3
                      }}>
                        Permissions & Restrictions
                      </Typography>
                      
                      {rightsData.rights_status?.usage_permissions?.length > 0 && (
                        <Box sx={{ mb: 2 }}>
                          <Typography sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '12px', mb: 1 }}>
                            Usage Permissions
                          </Typography>
                          {rightsData.rights_status.usage_permissions.map((permission: string, index: number) => (
                            <Chip 
                              key={index}
                              label={permission} 
                              size="small" 
                              sx={{ 
                                bgcolor: 'rgba(76, 175, 80, 0.3)', 
                                color: 'white',
                                fontSize: '12px',
                                mr: 1,
                                mb: 0.5
                              }} 
                            />
                          ))}
                        </Box>
                      )}
                      
                      {rightsData.rights_status?.restrictions?.length > 0 && (
                        <Box sx={{ mb: 2 }}>
                          <Typography sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '12px', mb: 1 }}>
                            Restrictions
                          </Typography>
                          {rightsData.rights_status.restrictions.map((restriction: string, index: number) => (
                            <Typography key={index} sx={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '12px', mb: 0.5 }}>
                              • {restriction}
                            </Typography>
                          ))}
                        </Box>
                      )}
                      
                      {rightsData.rights_status?.territory_rights && (
                        <Box>
                          <Typography sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '12px', mb: 0.5 }}>
                            Territory Rights
                          </Typography>
                          <Typography sx={{ color: 'white', fontSize: '14px', fontWeight: 600 }}>
                            {rightsData.rights_status.territory_rights}
                          </Typography>
                        </Box>
                      )}
                    </Box>

                    {/* Contacts Card */}
                    <Box sx={{ 
                      flex: 1,
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
                    }}>
                      <Typography sx={{ 
                        color: 'rgba(255, 255, 255, 0.9)', 
                        fontSize: '16px', 
                        fontWeight: 700, 
                        letterSpacing: '0.5px',
                        mb: 3
                      }}>
                        Contacts
                      </Typography>
                      
                      {rightsData.contacts?.primary_contact && (
                        <Box sx={{ mb: 2 }}>
                          <Typography sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '12px', mb: 0.5 }}>
                            Primary Contact
                          </Typography>
                          <Typography sx={{ color: 'white', fontSize: '14px', fontWeight: 600 }}>
                            {rightsData.contacts.primary_contact}
                          </Typography>
                        </Box>
                      )}
                      
                      {rightsData.contacts?.additional_contacts?.length > 0 && (
                        <Box sx={{ mb: 2 }}>
                          <Typography sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '12px', mb: 1 }}>
                            Additional Contacts
                          </Typography>
                          {rightsData.contacts.additional_contacts.map((contact: string, index: number) => (
                            <Typography key={index} sx={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '12px', mb: 0.5 }}>
                              • {contact}
                            </Typography>
                          ))}
                        </Box>
                      )}
                      
                      {rightsData.warnings?.length > 0 && (
                        <Box>
                          <Typography sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '12px', mb: 1 }}>
                            Warnings
                          </Typography>
                          {rightsData.warnings.map((warning: string, index: number) => (
                            <Chip 
                              key={index}
                              label={warning} 
                              size="small" 
                              sx={{ 
                                bgcolor: 'rgba(255, 152, 0, 0.3)', 
                                color: 'white',
                                fontSize: '10px',
                                mr: 1,
                                mb: 0.5
                              }} 
                            />
                          ))}
                        </Box>
                      )}
                    </Box>
                  </Box>
                </Box>
              );
            })() : (
              <Box sx={{ mb: 6 }}>
                <Typography variant="h5" sx={{ color: 'white', fontWeight: 600, mb: 3 }}>
                  Rights Validation
                </Typography>
                <Box sx={{ 
                  textAlign: 'center', 
                  py: 4, 
                  color: 'rgba(255, 255, 255, 0.6)' 
                }}>
                  <Typography variant="body1">
                    No rights validation information available for this analysis. 
                  </Typography>
                </Box>
              </Box>
            )}
            
            {/* QC Validation Section */}
            {analysisResult.qcResultRaw ? (() => {
              console.log('QC Raw Results:', analysisResult.qcResultRaw);
              let qcData;
              try {
                qcData = JSON.parse(analysisResult.qcResultRaw);
                console.log('QC Parsed Data:', qcData);
                // Ensure data structure exists with safe defaults
                qcData = {
                  qc_status: qcData?.qc_status || 'UNKNOWN',
                  confidence: qcData?.confidence || 0,
                  filename_language: qcData?.filename_language || 'Unknown',
                  content_language: qcData?.content_language || 'Unknown',
                  validation_method: qcData?.validation_method || 'Unknown',
                  summary: qcData?.summary || 'No summary available',
                  issues: Array.isArray(qcData?.issues) ? qcData.issues : [],
                  recommendations: Array.isArray(qcData?.recommendations) ? qcData.recommendations : [],
                  analysis_metadata: {
                    language_match: qcData?.analysis_metadata?.language_match !== undefined ? qcData.analysis_metadata.language_match : true,
                    validation_source: qcData?.analysis_metadata?.validation_source || 'Unknown'
                  }
                };
                console.log('QC Normalized Data:', qcData);
              } catch (e) {
                console.error('QC JSON Parse Error:', e);
                return (
                  <Box sx={{ textAlign: 'center', py: 4, color: 'rgba(255, 255, 255, 0.6)' }}>
                    <Typography>Invalid QC validation data</Typography>
                    <Typography sx={{ fontSize: '12px', mt: 1 }}>Raw data: {analysisResult.qcResultRaw?.substring(0, 200)}...</Typography>
                  </Box>
                );
              }
              
              const getStatusColor = (status: string) => {
                switch (status) {
                  case 'PASS': return '#4caf50';
                  case 'FAIL': return '#f44336';
                  case 'WARNING': return '#ff9800';
                  default: return '#9e9e9e';
                }
              };
              
              return (
                <Box>
                  <Typography variant="h5" sx={{ color: 'white', fontWeight: 600, mb: 3 }}>
                    Quality Control Validation
                  </Typography>
                  
                  {/* QC Status Header */}
                  <Box sx={{ 
                    display: 'flex', 
                    justifyContent: 'center', 
                    alignItems: 'center', 
                    mb: 4,
                    p: 3,
                    background: `linear-gradient(135deg, ${getStatusColor(qcData.qc_status)}20 0%, rgba(138, 43, 226, 0.1) 100%)`,
                    borderRadius: 3,
                    border: `1px solid ${getStatusColor(qcData.qc_status)}40`,
                    backdropFilter: 'blur(10px)'
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, textAlign: 'center' }}>
                      <SecurityIcon sx={{ 
                        color: getStatusColor(qcData.qc_status), 
                        fontSize: 32 
                      }} />
                      <Box>
                        <Typography variant="h4" sx={{ color: 'white', fontWeight: 700, mb: 0.5 }}>
                          {qcData.qc_status}
                        </Typography>
                        <Typography sx={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '14px' }}>
                          Confidence: {qcData.confidence}%
                        </Typography>
                      </Box>
                    </Box>
                  </Box>

                  {/* QC Information Cards */}
                  <Box sx={{ display: 'flex', gap: 3 }}>
                    {/* Language Analysis Card */}
                    <Box sx={{ 
                      flex: 1,
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
                    }}>
                      <Typography sx={{ 
                        color: 'rgba(255, 255, 255, 0.9)', 
                        fontSize: '16px', 
                        fontWeight: 700, 
                        letterSpacing: '0.5px',
                        mb: 3
                      }}>
                        Language Analysis
                      </Typography>
                      
                      <Box sx={{ mb: 2 }}>
                        <Typography sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '12px', mb: 0.5 }}>
                          Filename Language
                        </Typography>
                        <Typography sx={{ color: 'white', fontSize: '14px', fontWeight: 600 }}>
                          {qcData.filename_language}
                        </Typography>
                      </Box>
                      
                      <Box sx={{ mb: 2 }}>
                        <Typography sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '12px', mb: 0.5 }}>
                          Content Language
                        </Typography>
                        <Typography sx={{ color: 'white', fontSize: '14px', fontWeight: 600 }}>
                          {qcData.content_language}
                        </Typography>
                      </Box>
                      
                      <Box sx={{ mb: 2 }}>
                        <Typography sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '12px', mb: 0.5 }}>
                          Validation Method
                        </Typography>
                        <Typography sx={{ color: 'white', fontSize: '14px', fontWeight: 600 }}>
                          {qcData.validation_method}
                        </Typography>
                      </Box>
                      
                      {qcData.analysis_metadata?.language_match !== undefined && (
                        <Box>
                          <Typography sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '12px', mb: 0.5 }}>
                            Language Match
                          </Typography>
                          <Chip 
                            label={qcData.analysis_metadata.language_match ? 'Match' : 'Mismatch'} 
                            size="small" 
                            sx={{ 
                              bgcolor: qcData.analysis_metadata.language_match ? 'rgba(76, 175, 80, 0.3)' : 'rgba(244, 67, 54, 0.3)', 
                              color: 'white',
                              fontSize: '12px'
                            }} 
                          />
                        </Box>
                      )}
                    </Box>

                    {/* Issues & Summary Card */}
                    <Box sx={{ 
                      flex: 1,
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
                    }}>
                      <Typography sx={{ 
                        color: 'rgba(255, 255, 255, 0.9)', 
                        fontSize: '16px', 
                        fontWeight: 700, 
                        letterSpacing: '0.5px',
                        mb: 3
                      }}>
                        Summary & Issues
                      </Typography>
                      
                      <Box sx={{ mb: 2 }}>
                        <Typography sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '12px', mb: 1 }}>
                          Summary
                        </Typography>
                        <Typography sx={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '14px', lineHeight: 1.4 }}>
                          {qcData.summary}
                        </Typography>
                      </Box>
                      
                      {qcData.issues?.length > 0 && (
                        <Box>
                          <Typography sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '12px', mb: 1 }}>
                            Issues ({qcData.issues.length})
                          </Typography>
                          <Box sx={{ maxHeight: '150px', overflowY: 'auto' }}>
                            {qcData.issues.map((issue: string, index: number) => (
                              <Typography key={index} sx={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '12px', mb: 0.5 }}>
                                • {issue}
                              </Typography>
                            ))}
                          </Box>
                        </Box>
                      )}
                    </Box>

                    {/* Recommendations Card */}
                    <Box sx={{ 
                      flex: 1,
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
                    }}>
                      <Typography sx={{ 
                        color: 'rgba(255, 255, 255, 0.9)', 
                        fontSize: '16px', 
                        fontWeight: 700, 
                        letterSpacing: '0.5px',
                        mb: 3
                      }}>
                        Recommendations
                      </Typography>
                      
                      {qcData.recommendations?.length > 0 ? (
                        <Box sx={{ maxHeight: '200px', overflowY: 'auto' }}>
                          {qcData.recommendations.map((recommendation: string, index: number) => (
                            <Typography key={index} sx={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '12px', mb: 1, lineHeight: 1.4 }}>
                              • {recommendation}
                            </Typography>
                          ))}
                        </Box>
                      ) : (
                        <Typography sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '14px', fontStyle: 'italic' }}>
                          No recommendations available
                        </Typography>
                      )}
                      
                      {qcData.analysis_metadata && (
                        <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
                          <Typography sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '12px', mb: 1 }}>
                            Validation Source
                          </Typography>
                          <Typography sx={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '12px' }}>
                            {qcData.analysis_metadata.validation_source}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  </Box>
                </Box>
              );
            })() : (
              <Box>
                <Typography variant="h5" sx={{ color: 'white', fontWeight: 600, mb: 3 }}>
                  Quality Control Validation
                </Typography>
                <Box sx={{ 
                  textAlign: 'center', 
                  py: 4, 
                  color: 'rgba(255, 255, 255, 0.6)' 
                }}>
                  <Typography variant="body1">
                    No QC validation information available for this analysis.
                  </Typography>
                </Box>
              </Box>
            )}
            
            {/* IMDb Validation Section */}
            {analysisResult.imdbResultRaw ? (() => {
              console.log('IMDb Raw Results:', analysisResult.imdbResultRaw);
              let imdbData;
              try {
                imdbData = JSON.parse(analysisResult.imdbResultRaw);
                console.log('IMDb Parsed Data:', imdbData);
                // Ensure data structure exists with safe defaults
                imdbData = {
                  summaryStatistics: {
                    totalEntries: imdbData?.summaryStatistics?.totalEntries || 0,
                    confirmedMatches: imdbData?.summaryStatistics?.confirmedMatches || 0,
                    similarFindings: imdbData?.summaryStatistics?.similarFindings || 0,
                    notValidated: imdbData?.summaryStatistics?.notValidated || 0,
                    overallAccuracyPercentage: imdbData?.summaryStatistics?.overallAccuracyPercentage || 0
                  },
                  validationResults: imdbData?.validationResults && typeof imdbData.validationResults === 'object' ? imdbData.validationResults : {}
                };
              } catch (e) {
                return (
                  <Box sx={{ textAlign: 'center', py: 4, color: 'rgba(255, 255, 255, 0.6)' }}>
                    <Typography>Invalid IMDb validation data</Typography>
                  </Box>
                );
              }
              
              return (
                <Box sx={{ mt: 6 }}>
                  <Typography variant="h5" sx={{ color: 'white', fontWeight: 600, mb: 3 }}>
                    IMDb Validation
                  </Typography>
                  
                  {/* IMDb Status Header */}
                  <Box sx={{ 
                    display: 'flex', 
                    justifyContent: 'center', 
                    alignItems: 'center', 
                    mb: 4,
                    p: 3,
                    background: 'linear-gradient(135deg, rgba(255, 193, 7, 0.1) 0%, rgba(138, 43, 226, 0.1) 100%)',
                    borderRadius: 3,
                    border: '1px solid rgba(255, 193, 7, 0.2)',
                    backdropFilter: 'blur(10px)'
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, textAlign: 'center' }}>
                      <SummarizeIcon sx={{ 
                        color: '#ffc107', 
                        fontSize: 32 
                      }} />
                      <Box>
                        <Typography variant="h4" sx={{ color: 'white', fontWeight: 700, mb: 0.5 }}>
                          IMDb Cross-Reference
                        </Typography>
                        <Typography sx={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '14px' }}>
                          {imdbData.summaryStatistics?.totalEntries || 0} entries validated
                        </Typography>
                      </Box>
                    </Box>
                  </Box>

                  {/* IMDb Validation Cards */}
                  <Box sx={{ display: 'flex', gap: 3 }}>
                    {/* Validation Summary Card */}
                    <Box sx={{ 
                      flex: 1,
                      background: 'linear-gradient(135deg, rgba(255, 193, 7, 0.1) 0%, rgba(138, 43, 226, 0.1) 100%)',
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
                        background: 'linear-gradient(90deg, #ffc107, #8a2be2)'
                      }
                    }}>
                      <Typography sx={{ 
                        color: 'rgba(255, 255, 255, 0.9)', 
                        fontSize: '16px', 
                        fontWeight: 700, 
                        letterSpacing: '0.5px',
                        mb: 3
                      }}>
                        Validation Summary
                      </Typography>
                      
                      {imdbData.summaryStatistics && (
                        <>
                          <Box sx={{ mb: 2 }}>
                            <Typography sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '12px', mb: 0.5 }}>
                              Total Entries
                            </Typography>
                            <Typography sx={{ color: 'white', fontSize: '14px', fontWeight: 600 }}>
                              {imdbData.summaryStatistics.totalEntries}
                            </Typography>
                          </Box>
                          
                          <Box sx={{ mb: 2 }}>
                            <Typography sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '12px', mb: 0.5 }}>
                              Confirmed Matches
                            </Typography>
                            <Typography sx={{ color: 'white', fontSize: '14px', fontWeight: 600 }}>
                              {imdbData.summaryStatistics.confirmedMatches}
                            </Typography>
                          </Box>
                          
                          <Box sx={{ mb: 2 }}>
                            <Typography sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '12px', mb: 0.5 }}>
                              Similar Findings
                            </Typography>
                            <Typography sx={{ color: 'white', fontSize: '14px', fontWeight: 600 }}>
                              {imdbData.summaryStatistics.similarFindings || 0}
                            </Typography>
                          </Box>

                          <Box sx={{ mb: 2 }}>
                            <Typography sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '12px', mb: 0.5 }}>
                              Not Validated
                            </Typography>
                            <Typography sx={{ color: 'white', fontSize: '14px', fontWeight: 600 }}>
                              {imdbData.summaryStatistics.notValidated || 0}
                            </Typography>
                          </Box>
                          
                          <Box>
                            <Typography sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '12px', mb: 0.5 }}>
                              Accuracy
                            </Typography>
                            <Typography sx={{ color: 'white', fontSize: '14px', fontWeight: 600 }}>
                              {imdbData.summaryStatistics.overallAccuracyPercentage || 0}%
                            </Typography>
                          </Box>
                        </>
                      )}
                    </Box>

                    {/* Validation Results Card */}
                    <Box sx={{ 
                      flex: 2,
                      background: 'linear-gradient(135deg, rgba(255, 193, 7, 0.1) 0%, rgba(138, 43, 226, 0.1) 100%)',
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
                        background: 'linear-gradient(90deg, #ffc107, #8a2be2)'
                      }
                    }}>
                      <Typography sx={{ 
                        color: 'rgba(255, 255, 255, 0.9)', 
                        fontSize: '16px', 
                        fontWeight: 700, 
                        letterSpacing: '0.5px',
                        mb: 3
                      }}>
                        Validation Results by Category
                      </Typography>
                      
                      {imdbData.validationResults && Object.keys(imdbData.validationResults).length > 0 ? (
                        <Box sx={{ maxHeight: '400px', overflowY: 'auto' }}>
                          {Object.entries(imdbData.validationResults).map(([category, categoryData]: [string, any]) => {
                            // Handle both old array format and new object format
                            const isNewFormat = categoryData && typeof categoryData === 'object' && !Array.isArray(categoryData);

                            if (isNewFormat) {
                              // New format with imdbEntry, complianceAnalysis, validationResult, etc.
                              const getValidationColor = (result: string) => {
                                switch (result) {
                                  case 'CONFIRMED': return 'rgba(76, 175, 80, 0.3)';
                                  case 'SIMILAR_FINDINGS': return 'rgba(255, 152, 0, 0.3)';
                                  case 'NOT_VALIDATED': return 'rgba(244, 67, 54, 0.3)';
                                  default: return 'rgba(158, 158, 158, 0.3)';
                                }
                              };

                              return (
                                <Box key={category} sx={{ 
                                  mb: 3, 
                                  p: 3, 
                                  bgcolor: 'rgba(0,0,0,0.3)', 
                                  borderRadius: 2,
                                  border: '1px solid rgba(255, 255, 255, 0.1)'
                                }}>
                                  <Typography sx={{ 
                                    color: 'white', 
                                    fontSize: '16px', 
                                    fontWeight: 700, 
                                    mb: 2,
                                    borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
                                    pb: 1
                                  }}>
                                    {category}
                                  </Typography>

                                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
                                    <Chip 
                                      label={categoryData.validationResult || 'Unknown'} 
                                      size="small" 
                                      sx={{ 
                                        bgcolor: getValidationColor(categoryData.validationResult),
                                        color: 'white',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        minWidth: '120px'
                                      }} 
                                    />
                                    <Typography sx={{ 
                                      color: 'rgba(255, 255, 255, 0.7)', 
                                      fontSize: '12px',
                                      fontWeight: 500
                                    }}>
                                      Confidence: {Math.round((categoryData.confidenceScore || 0) * 100)}%
                                    </Typography>
                                  </Box>

                                  {/* IMDb Entry */}
                                  {categoryData.imdbEntry && (
                                    <Box sx={{ mb: 2 }}>
                                      <Typography sx={{ 
                                        color: 'rgba(255, 193, 7, 0.9)', 
                                        fontSize: '12px', 
                                        fontWeight: 600,
                                        mb: 1,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px'
                                      }}>
                                        IMDb Entry
                                      </Typography>
                                      {Array.isArray(categoryData.imdbEntry) ? (
                                        <Box sx={{ pl: 1 }}>
                                          {categoryData.imdbEntry.map((entry: string, index: number) => (
                                            <Typography key={index} sx={{ 
                                              color: 'rgba(255, 255, 255, 0.9)', 
                                              fontSize: '13px',
                                              mb: 1,
                                              lineHeight: 1.4,
                                              '&:before': {
                                                content: '"• "',
                                                color: 'rgba(255, 193, 7, 0.7)'
                                              }
                                            }}>
                                              {entry}
                                            </Typography>
                                          ))}
                                        </Box>
                                      ) : (
                                        <Typography sx={{ 
                                          color: 'rgba(255, 255, 255, 0.9)', 
                                          fontSize: '13px',
                                          lineHeight: 1.4,
                                          pl: 1
                                        }}>
                                          {categoryData.imdbEntry}
                                        </Typography>
                                  )}
                                    </Box>
                                  )}

                                  {/* Compliance Analysis */}
                                  {categoryData.complianceAnalysis && (
                                    <Box sx={{ mb: 2 }}>
                                      <Typography sx={{ 
                                        color: 'rgba(138, 43, 226, 0.9)', 
                                        fontSize: '12px', 
                                        fontWeight: 600,
                                        mb: 1,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px'
                                      }}>
                                        Compliance Analysis
                                      </Typography>
                                      <Typography sx={{ 
                                        color: 'rgba(255, 255, 255, 0.8)', 
                                        fontSize: '13px',
                                        lineHeight: 1.4,
                                        pl: 1
                                      }}>
                                        {categoryData.complianceAnalysis}
                                      </Typography>
                                    </Box>
                                  )}

                                  {/* Analysis Notes */}
                                  {categoryData.analysisNotes && (
                                    <Box sx={{ 
                                      mt: 2,
                                      pt: 2,
                                      borderTop: '1px solid rgba(255, 255, 255, 0.1)'
                                    }}>
                                      <Typography sx={{ 
                                        color: 'rgba(0, 188, 212, 0.9)', 
                                        fontSize: '12px', 
                                        fontWeight: 600,
                                        mb: 1,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px'
                                      }}>
                                        Analysis Notes
                                      </Typography>
                                      <Typography sx={{ 
                                        color: 'rgba(255, 255, 255, 0.7)', 
                                        fontSize: '12px',
                                        lineHeight: 1.4,
                                        fontStyle: 'italic',
                                        pl: 1
                                      }}>
                                        {categoryData.analysisNotes}
                                      </Typography>
                                    </Box>
                                  )}
                                </Box>
                              );
                            } else {
                              // Legacy format - keep existing implementation for backward compatibility
                              const entries = Array.isArray(categoryData) ? categoryData : [];
                              return (
                                <Box key={category} sx={{ mb: 3, p: 2, bgcolor: 'rgba(0,0,0,0.2)', borderRadius: 1 }}>
                                  <Typography sx={{ 
                                    color: 'white', 
                                    fontSize: '14px', 
                                    fontWeight: 600, 
                                    mb: 2
                                  }}>
                                    {category}
                                  </Typography>

                                  {entries.length > 0 ? (
                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                      {entries.slice(0, 3).map((entry: any, index: number) => (
                                        <Box key={index} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
                                          <Chip 
                                            label={entry?.validationStatus || 'Unknown'} 
                                            size="small" 
                                            sx={{ 
                                              bgcolor: entry?.validationStatus === 'CONFIRMED' 
                                                ? 'rgba(76, 175, 80, 0.3)' 
                                                : entry?.validationStatus === 'SIMILAR'
                                                ? 'rgba(255, 152, 0, 0.3)'
                                                : 'rgba(244, 67, 54, 0.3)', 
                                              color: 'white',
                                              fontSize: '10px',
                                              minWidth: '80px',
                                              mt: 0.5
                                            }} 
                                          />
                                          <Box sx={{ flex: 1 }}>
                                            <Typography sx={{ 
                                              color: 'rgba(255, 255, 255, 0.8)', 
                                              fontSize: '12px',
                                              mb: 0.5
                                            }}>
                                              {entry?.text || 'No text available'}
                                            </Typography>
                                            <Typography sx={{ 
                                              color: 'rgba(255, 255, 255, 0.5)', 
                                              fontSize: '10px',
                                              fontStyle: 'italic'
                                            }}>
                                              Confidence: {Math.round((entry?.confidenceScore || 0) * 100)}%
                                            </Typography>
                                          </Box>
                                        </Box>
                                      ))}
                                      {entries.length > 3 && (
                                        <Typography sx={{ 
                                          color: 'rgba(255, 255, 255, 0.6)', 
                                          fontSize: '11px',
                                          fontStyle: 'italic',
                                          mt: 1
                                        }}>
                                          +{entries.length - 3} more entries
                                        </Typography>
                                      )}
                                    </Box>
                                  ) : (
                                    <Typography sx={{ 
                                      fontSize: '12px',
                                      fontStyle: 'italic'
                                    }}>
                                      No entries found
                                    </Typography>
                                  )}
                                </Box>
                              );
                            }
                          })}
                        </Box>
                      ) : (
                        <Typography sx={{ 
                          color: 'rgba(255, 255, 255, 0.6)', 
                          fontSize: '14px',
                          fontStyle: 'italic'
                        }}>
                          No validation results available
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </Box>
              );
            })() : (
              <Box sx={{ mt: 6 }}>
                <Typography variant="h5" sx={{ color: 'white', fontWeight: 600, mb: 3 }}>
                  IMDb Validation
                </Typography>
                <Box sx={{ 
                  textAlign: 'center', 
                  py: 4, 
                  color: 'rgba(255, 255, 255, 0.6)' 
                }}>
                  <Typography variant="body1">
                    No IMDb validation information available for this analysis.
                  </Typography>
                </Box>
              </Box>
            )}
          </Box>
        )}

        {/* Analysis Cost Tab */}
        {activeTab === 3 && (
          <Box sx={{ p: 3 }}>
            {statistics.length > 0 ? (
              <>
                {/* Main Headers */}
                <Box sx={{ 
                  display: 'flex', 
                  justifyContent: 'center', 
                  alignItems: 'center', 
                  mb: 4,
                  p: 3,
                  background: 'linear-gradient(135deg, rgba(138, 43, 226, 0.1) 0%, rgba(0, 188, 212, 0.1) 100%)',
                  borderRadius: 3,
                  border: '1px solid rgba(138, 43, 226, 0.2)',
                  backdropFilter: 'blur(10px)'
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, textAlign: 'center' }}>
                    <AttachMoneyOutlined sx={{ color: '#00bcd4', fontSize: 32 }} />
                    <Box>
                      <Typography variant="h4" sx={{ color: 'white', fontWeight: 700, mb: 0.5 }}>
                        ${formatCost(totalCost)}
                      </Typography>
                      <Typography sx={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '14px' }}>
                        Total Analysis Cost
                      </Typography>
                      <Typography sx={{ color: 'rgba(255, 255, 255, 0.45)', fontSize: '11px', mt: 0.5 }}>
                        On-Demand pricing · us-west-2
                      </Typography>
                    </Box>
                  </Box>
                  
                  <Box sx={{ 
                    width: '1px', 
                    height: '60px', 
                    backgroundColor: 'white', 
                    mx: 8,
                    opacity: 0.3
                  }} />
                  
                  <Tooltip title={!analysisResult.workflowTime ? "Workflow time is still being calculated. Refresh the page." : ""} arrow>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, textAlign: 'center', cursor: !analysisResult.workflowTime ? 'help' : 'default' }}>
                      <AccessTimeOutlined sx={{ color: '#8a2be2', fontSize: 32 }} />
                      <Box>
                        <Typography variant="h4" sx={{ color: 'white', fontWeight: 700, mb: 0.5 }}>
                          {analysisResult.workflowTime ? formatProcessingTime(analysisResult.workflowTime) : '—'}
                        </Typography>
                        <Typography sx={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '14px' }}>
                          Total Workflow Time
                        </Typography>
                        {!analysisResult.workflowTime && (
                          <Typography sx={{ color: 'rgba(255, 193, 7, 0.8)', fontSize: '11px', mt: 0.5 }}>
                            Still calculating — try refreshing the page
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </Tooltip>
                </Box>

                {/* Core Analysis Cards - First Row */}
                <Box sx={{ display: 'flex', gap: 3, mb: 6 }}>
                  {[
                    { key: 'video', processingType: 'Video' },
                    { key: 'frame', processingType: 'Frame' },
                    { key: 'transcript', processingType: 'Transcript' }
                  ].map(({ key, processingType }) => {
                    const data = processingTypeBreakdown[processingType] || { inputTokenCost: 0, outputTokenCost: 0, processingTime: 0, duration: 0, count: 0 };
                    const totalTypeCost = data.inputTokenCost + data.outputTokenCost;
                    // Use single duration value (not summed) since each stat records the full video duration
                    const contentDuration = (() => {
                      const stats = statistics.filter(s => s.processingType === processingType && (s.duration || 0) > 0);
                      return stats.length > 0 ? (stats[0].duration || 0) : 0;
                    })();
                    
                    // Check if frame analysis is incomplete based on progress bar status
                    const isFrameAnalysisIncomplete = key === 'frame' && (
                      analysisResult?.framesAnalysed == null || 
                      analysisResult?.framesToAnalyse == null || 
                      analysisResult.framesAnalysed < analysisResult.framesToAnalyse
                    );
                    
                    const gradient = 'linear-gradient(135deg, rgba(0, 188, 212, 0.1) 0%, rgba(138, 43, 226, 0.1) 100%)';
                    
                    return (
                      <Box key={key} sx={{ 
                        flex: 1,
                        background: gradient,
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
                      }}>
                        {/* Warning banner for incomplete frame analysis */}
                        {isFrameAnalysisIncomplete && (
                          <Box sx={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            background: 'linear-gradient(90deg, rgba(255, 193, 7, 0.2), rgba(255, 152, 0, 0.2))',
                            borderBottom: '1px solid rgba(255, 193, 7, 0.3)',
                            p: 1,
                            zIndex: 1
                          }}>
                            <Typography sx={{
                              color: 'rgba(255, 193, 7, 0.9)',
                              fontSize: '12px',
                              fontWeight: 600,
                              textAlign: 'center',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}>
                              ⚠️ Frame analysis in progress
                            </Typography>
                          </Box>
                        )}
                        
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, mt: isFrameAnalysisIncomplete ? 2 : 0 }}>
                          <Typography sx={{ 
                            color: 'rgba(255, 255, 255, 0.9)', 
                            fontSize: '16px', 
                            fontWeight: 700, 
                            textTransform: 'capitalize',
                            letterSpacing: '0.5px'
                          }}>
                            {key === 'frame' ? 'Frame' : key} Analysis
                            {(key === 'video' || key === 'transcript') && contentDuration > 0 && (
                              <Typography component="span" sx={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '14px', fontWeight: 400, ml: 1 }}>
                                ({formatProcessingTime(contentDuration)})
                              </Typography>
                            )}
                            {key === 'frame' && analysisResult?.framesAnalysed != null && (
                              <Typography component="span" sx={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '14px', fontWeight: 400, ml: 1 }}>
                                ({analysisResult.framesAnalysed.toLocaleString()} frames)
                              </Typography>
                            )}
                          </Typography>
                        </Box>
                        
                        {/* Cost Section */}
                        <Box sx={{ mb: 3 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <AttachMoneyOutlined sx={{ color: '#00bcd4', fontSize: 20 }} />
                            <Typography sx={{ 
                              color: 'white', 
                              fontSize: '28px', 
                              fontWeight: 700
                            }}>
                              ${formatCost(totalTypeCost)}
                            </Typography>
                          </Box>
                          {data.inputTokenCost > 0 && key !== 'transcript' && (
                            <Box sx={{ ml: 3 }}>
                              <Typography sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '12px', mb: 0.5 }}>
                                Input Tokens: ${formatCost(data.inputTokenCost)}
                              </Typography>
                              <Typography sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '12px' }}>
                                Output Tokens: ${formatCost(data.outputTokenCost)}
                              </Typography>
                            </Box>
                          )}
                        </Box>
                        
                        {/* Service Attribution */}
                        <Box sx={{ 
                          position: 'absolute',
                          bottom: 12,
                          right: 12
                        }}>
                          <Typography sx={{ 
                            color: 'white', 
                            fontSize: '13px',
                            fontWeight: 600
                          }}>
                            {key === 'transcript' ? 'Amazon Transcribe' : 'Amazon Bedrock'}
                          </Typography>
                        </Box>
                        

                        
                        {/* Time Section */}
                        {key !== 'frame' && (
                        <Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <AccessTimeOutlined sx={{ color: '#8a2be2', fontSize: 20 }} />
                            <Typography sx={{ 
                              color: 'white', 
                              fontSize: '20px', 
                              fontWeight: 600
                            }}>
                              {formatProcessingTime(data.processingTime)}
                            </Typography>
                          </Box>
                          <Typography sx={{ 
                            color: 'rgba(255, 255, 255, 0.6)', 
                            fontSize: '12px',
                            ml: 3
                          }}>
                            {key === 'video' ? 'Analysis Duration' : 'Generation Duration'}
                          </Typography>
                        </Box>
                        )}

                        {/* Cost reduction tip for frame analysis */}
                        {key === 'frame' && (
                          <Tooltip title="To reduce frame analysis cost, try adjusting the pHash threshold in the Config page to filter out similar frames, or choose a more cost-effective model." arrow placement="top">
                            <Box sx={{
                              position: 'absolute',
                              bottom: 12,
                              left: 12,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 0.5,
                              cursor: 'help',
                              backgroundColor: 'rgba(0, 188, 212, 0.1)',
                              border: '1px solid rgba(0, 188, 212, 0.3)',
                              borderRadius: 2,
                              px: 1,
                              py: 0.5,
                            }}>
                              <InfoOutlinedIcon sx={{ fontSize: 14, color: '#00bcd4' }} />
                              <Typography sx={{ color: '#00bcd4', fontSize: '11px', fontWeight: 600 }}>
                                Cost reduction tip
                              </Typography>
                            </Box>
                          </Tooltip>
                        )}
                      </Box>
                    );
                  })}
                </Box>

                {/* Divider */}
                <Box sx={{ 
                  width: '100%', 
                  height: '3px', 
                  background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent)',
                  mb: 6
                }} />

                {/* Optional Section Header and Subtotal */}
                <Box sx={{ mb: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Typography variant="h6" sx={{ color: 'rgba(255, 255, 255, 0.8)', fontWeight: 600 }}>
                        Optional Analysis
                      </Typography>
                      <Typography sx={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '14px' }}>
                        (cost and processing duration not included in totals)
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <AttachMoneyOutlined sx={{ color: '#00bcd4', fontSize: 18 }} />
                      <Typography sx={{ color: 'white', fontSize: '20px', fontWeight: 700 }}>
                        ${formatCost(optionalCost)}
                      </Typography>
                      <Typography sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '14px', ml: 1 }}>
                        (not included in total cost)
                      </Typography>
                    </Box>
                  </Box>
                </Box>

                {/* Optional Analysis Cards - Second Row */}
                <Box sx={{ display: 'flex', gap: 3 }}>
                  {[
                    { key: 'agent', processingType: 'Agent' },
                    { key: 'profanity', processingType: 'Profanity' }
                  ].map(({ key, processingType }) => {
                    const data = processingTypeBreakdown[processingType] || { inputTokenCost: 0, outputTokenCost: 0, processingTime: 0 };
                    const totalTypeCost = data.inputTokenCost + data.outputTokenCost;
                    
                    const gradient = 'linear-gradient(135deg, rgba(0, 188, 212, 0.1) 0%, rgba(138, 43, 226, 0.1) 100%)';
                    
                    return (
                      <Box key={key} sx={{ 
                        flex: 1,
                        background: gradient,
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
                      }}>
                        
                        <Typography sx={{ 
                          color: 'rgba(255, 255, 255, 0.9)', 
                          fontSize: '16px', 
                          fontWeight: 700, 
                          textTransform: 'capitalize',
                          letterSpacing: '0.5px',
                          mb: 3
                        }}>
                          {processingType} Analysis
                        </Typography>
                        
                        {/* Cost Section */}
                        <Box sx={{ mb: 3 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <AttachMoneyOutlined sx={{ color: '#00bcd4', fontSize: 20 }} />
                            <Typography sx={{ 
                              color: 'white', 
                              fontSize: '28px', 
                              fontWeight: 700
                            }}>
                              ${formatCost(totalTypeCost)}
                            </Typography>
                          </Box>
                          {data.inputTokenCost > 0 && (
                            <Box sx={{ ml: 3 }}>
                              <Typography sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '12px', mb: 0.5 }}>
                                Input Tokens: ${formatCost(data.inputTokenCost)}
                              </Typography>
                              <Typography sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '12px' }}>
                                Output Tokens: ${formatCost(data.outputTokenCost)}
                              </Typography>
                            </Box>
                          )}
                        </Box>
                        
                        {/* Service Attribution */}
                        <Box sx={{ 
                          position: 'absolute',
                          bottom: 12,
                          right: 12
                        }}>
                          <Typography sx={{ 
                            color: 'white', 
                            fontSize: '13px',
                            fontWeight: 600
                          }}>
                            Amazon Bedrock
                          </Typography>
                        </Box>
                        
                        {/* Time Section */}
                        <Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <AccessTimeOutlined sx={{ color: '#8a2be2', fontSize: 20 }} />
                            <Typography sx={{ 
                              color: 'white', 
                              fontSize: '20px', 
                              fontWeight: 600
                            }}>
                              {formatProcessingTime(data.processingTime)}
                            </Typography>
                          </Box>
                          <Typography sx={{ 
                            color: 'rgba(255, 255, 255, 0.6)', 
                            fontSize: '12px',
                            ml: 3
                          }}>
                            Combined Processing Duration
                          </Typography>
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              </>
            ) : (
              <Box sx={{ 
                textAlign: 'center', 
                py: 8, 
                color: 'rgba(255, 255, 255, 0.6)' 
              }}>
                <Typography variant="body1">
                  No cost information available for this analysis.
                </Typography>
              </Box>
            )}
          </Box>
        )}
      </Paper>
      
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
            Inference Parameters
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
                {getModelDisplayName(analysisResult.bedrockModelId)}
              </Typography>
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 2 }}>
              <Box>
                <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px' }}>
                  Max Tokens
                </Typography>
                <Typography sx={{ color: 'white', fontSize: '14px' }}>
                  {analysisResult.inferenceMaxTokens ? analysisResult.inferenceMaxTokens.toLocaleString() : 'Default'}
                </Typography>
              </Box>
              <Box>
                <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px' }}>
                  Temperature
                </Typography>
                <Typography sx={{ color: 'white', fontSize: '14px' }}>
                  {analysisResult.inferenceTemperature || 'Default'}
                </Typography>
              </Box>
              <Box>
                <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px' }}>
                  Top P
                </Typography>
                <Typography sx={{ color: 'white', fontSize: '14px' }}>
                  {analysisResult.inferenceTopP || 'Default'}
                </Typography>
              </Box>
              <Box>
                <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px' }}>
                  Top K
                </Typography>
                <Typography sx={{ color: 'white', fontSize: '14px' }}>
                  {analysisResult.inferenceTopK || 'Default'}
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
      
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
      >
        <Alert severity="error" onClose={() => setSnackbarOpen(false)}>
          {error}
        </Alert>
      </Snackbar>
      

    </Box>
  );
}