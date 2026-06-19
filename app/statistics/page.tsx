'use client';

import React, { useEffect, useState } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';
import { StatisticsService } from '../../services/statistics';
import { IStatistic } from '../../types/statistic';
import { ProcessingType } from '../../amplify/global-variables';
import {
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  Paper,
  Divider,
  Snackbar,
  Alert,
  CircularProgress,
  Backdrop,
  Container
} from '@mui/material';
import {
  VideoLibraryOutlined,
  AttachMoneyOutlined,
  AccessTimeOutlined,
  AnalyticsOutlined,
  SubtitlesOutlined,
  PhotoCameraOutlined,
  TrendingUpOutlined,
  CameraAltOutlined,
  MovieFilterOutlined
} from '@mui/icons-material';

// Helper function to format numbers with commas
const formatNumber = (num: number) => {
  return num.toLocaleString();
};

const StatCard = ({ title, value, subtitle, icon, accentColor }: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  accentColor: string;
}) => (
  <Card sx={{ 
    height: '100%', 
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(10px)'
  }}>
    <CardContent>
      <Box display="flex" alignItems="center" mb={1}>
        <Box sx={{ color: accentColor, mr: 1, fontSize: '1.2rem' }}>{icon}</Box>
        <Typography variant="subtitle2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
          {title}
        </Typography>
      </Box>
      <Typography variant="h4" fontWeight="bold" sx={{ color: 'white' }}>
        {value}
      </Typography>
      {subtitle && (
        <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.5)', mt: 0.5 }}>
          {subtitle}
        </Typography>
      )}
    </CardContent>
  </Card>
);

const SectionCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <Card sx={{ 
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    backdropFilter: 'blur(10px)'
  }}>
    <CardContent>
      <Typography variant="h6" gutterBottom sx={{ color: 'white', mb: 3 }}>
        {title}
      </Typography>
      {children}
    </CardContent>
  </Card>
);

const ModelRow = ({ model, cost, usage, totalRequests }: {
  model: string;
  cost: string;
  usage: string;
  totalRequests?: number;
}) => (
  <Box py={1.5} px={2}
       sx={{ 
         backgroundColor: 'rgba(0, 0, 0, 0.3)',
         borderRadius: 1,
         mb: 1,
         border: '1px solid rgba(255, 255, 255, 0.1)',
         flex: '1 1 calc(50% - 8px)',
         mr: 1
       }}>
    <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
      <Typography variant="subtitle1" sx={{ color: 'white', fontWeight: 500 }}>
        {model}
      </Typography>
      {totalRequests !== undefined && (
        <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
          {formatNumber(totalRequests || 0)} requests
        </Typography>
      )}
    </Box>
    <Box display="flex" justifyContent="space-between" alignItems="end">
      <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.6)', whiteSpace: 'pre-line' }}>
        {usage}
      </Typography>
      <Typography variant="h6" sx={{ color: 'white', fontWeight: 'bold' }}>
        {cost}
      </Typography>
    </Box>
  </Box>
);

export default function StatisticsPage() {
  const [statistics, setStatistics] = useState<IStatistic[]>([]);
  const [allTimeStats, setAllTimeStats] = useState<Record<string, IStatistic[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [snackbarMessage, setSnackbarMessage] = useState<string>('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  useEffect(() => {
    const fetchStatistics = async () => {
      const session = await fetchAuthSession();
      const identityId = session.identityId;
          
      if (identityId) {
        try {
          const [monthlyResult, allTimeResult] = await Promise.all([
            StatisticsService.getStatisticsByIdentityId(identityId),
            StatisticsService.getAllStatistics()
          ]);
          
          // Filter statistics to current month only
          const currentMonth = new Date().getMonth();
          const currentYear = new Date().getFullYear();
          const filteredStats = monthlyResult.filter(stat => {
            const statDate = new Date(stat.createdAt);
            return statDate.getMonth() === currentMonth && statDate.getFullYear() === currentYear;
          });
          
          setStatistics(filteredStats);
          setAllTimeStats(allTimeResult);
          setIsLoading(false);
        } catch (error: any) {
          console.log(error);
          setSnackbarMessage(`Failed to fetch statistics: ${error.message || error}`);
          setSnackbarOpen(true);
          setIsLoading(false);
        }
      } else {
        setSnackbarMessage('No identity ID found');
        setSnackbarOpen(true);
        setIsLoading(false);
      }
    };

    fetchStatistics();
  }, []);

  if (isLoading) {
    return (
      <>
        <Container maxWidth="xl" sx={{ py: 4 }}>
          <Box sx={{ mb: 4 }}>
            <Typography 
              variant="h4" 
              component="h1" 
              sx={{ 
                fontWeight: 700,
                mb: 1,
                color: 'white'
              }}
            >
              Video Analysis Statistics
            </Typography>
          </Box>
        </Container>
        <Backdrop open={isLoading} sx={{ zIndex: 9999, flexDirection: 'column', gap: 2 }}>
          <CircularProgress color="inherit" />
          <Typography color="inherit" variant="h6">Loading statistics...</Typography>
        </Backdrop>
      </>
    );
  }

  const getUniqueVideoDuration = (stats: IStatistic[]) => {
    const uniqueVideoSessions = new Map<string, IStatistic>();
    stats
      .filter(stat => stat.processingType === ProcessingType.VIDEO)
      .forEach(stat => {
        if (!uniqueVideoSessions.has(stat.sessionId)) {
          uniqueVideoSessions.set(stat.sessionId, stat);
        }
      });
    return Array.from(uniqueVideoSessions.values()).reduce((sum, stat) => sum + (stat.duration || 0), 0);
  };

  const getUniqueVideosProcessed = (stats: IStatistic[]) => {
    const uniqueVideoSessions = new Set<string>();
    stats
      .filter(stat => stat.processingType === ProcessingType.VIDEO)
      .forEach(stat => {
        uniqueVideoSessions.add(stat.sessionId);
      });
    return uniqueVideoSessions.size;
  };

  const getUniqueTranscriptsProcessed = (stats: IStatistic[]) => {
    const uniqueTranscriptSessions = new Set<string>();
    stats
      .filter(stat => stat.processingType === ProcessingType.TRANSCRIPT)
      .forEach(stat => {
        uniqueTranscriptSessions.add(stat.sessionId);
      });
    return uniqueTranscriptSessions.size;
  };

  const totalCost = statistics.reduce((sum, stat) => sum + (stat.inputTokenCost || 0) + (stat.outputTokenCost || 0), 0);
  const totalVideos = getUniqueVideosProcessed(statistics);
  const totalDuration = getUniqueVideoDuration(statistics);
  const totalProcessingTime = statistics.reduce((sum, stat) => sum + (stat.processingTime || 0), 0);
  
  // Calculate video analysis cost
  const videoAnalysisCost = statistics
    .filter(stat => stat.processingType === ProcessingType.VIDEO)
    .reduce((sum, stat) => sum + (stat.inputTokenCost || 0) + (stat.outputTokenCost || 0), 0);
  
  // Calculate transcription analysis cost
  const transcriptionAnalysisCost = statistics
    .filter(stat => stat.processingType === ProcessingType.TRANSCRIPT)
    .reduce((sum, stat) => sum + (stat.inputTokenCost || 0) + (stat.outputTokenCost || 0), 0);
  const transcriptionCount = getUniqueTranscriptsProcessed(statistics);
  
  // Calculate agent analysis cost and count
  const agentAnalysisCost = statistics
    .filter(stat => stat.processingType === ProcessingType.AGENT)
    .reduce((sum, stat) => sum + (stat.inputTokenCost || 0) + (stat.outputTokenCost || 0), 0);
  const agentCount = statistics.filter(stat => stat.processingType === ProcessingType.AGENT).length;
  
  // Calculate frame analysis cost and count
  const frameAnalysisCost = statistics
    .filter(stat => stat.processingType === ProcessingType.FRAME)
    .reduce((sum, stat) => sum + (stat.inputTokenCost || 0) + (stat.outputTokenCost || 0), 0);
  const frameCount = statistics.filter(stat => stat.processingType === ProcessingType.FRAME).length;
  
  const formatProcessingTime = (seconds: number) => {
    if (seconds < 60) return `${seconds.toFixed(1)} sec`;
    const minutes = seconds / 60;
    if (minutes < 60) return `${minutes.toFixed(1)} min`;
    const hours = minutes / 60;
    return `${hours.toFixed(1)} hours`;
  };

  // Group statistics by model provider
  const providerStats = statistics.reduce((acc, stat) => {
    const provider = stat.modelProvider || 'Unknown';
    if (!acc[provider]) {
      acc[provider] = { cost: 0, count: 0 };
    }
    acc[provider].cost += (stat.inputTokenCost || 0) + (stat.outputTokenCost || 0);
    acc[provider].count += 1;
    return acc;
  }, {} as Record<string, { cost: number; count: number }>);

  const sortedProviders = Object.entries(providerStats)
    .sort(([,a], [,b]) => b.cost - a.cost)
    .map(([provider, stats]) => ({
      provider,
      cost: stats.cost,
      usage: `${stats.count} requests`,
      count: stats.count
    }));

  // Group statistics by model
  const modelStats = statistics.reduce((acc, stat) => {
    const modelId = stat.modelId || 'Unknown';
    if (!acc[modelId]) {
      const provider = stat.modelProvider || 'Unknown';
      const model = stat.model || stat.modelId || 'Unknown';
      acc[modelId] = { cost: 0, contentTypes: {}, displayName: `${provider} ${model}` };
    }
    acc[modelId].cost += (stat.inputTokenCost || 0) + (stat.outputTokenCost || 0);
    const contentType = stat.contentType || 'unknown';
    acc[modelId].contentTypes[contentType] = (acc[modelId].contentTypes[contentType] || 0) + 1;
    return acc;
  }, {} as Record<string, { cost: number; contentTypes: Record<string, number>; displayName: string }>);

  const sortedModels = Object.entries(modelStats)
    .sort(([,a], [,b]) => b.cost - a.cost)
    .map(([modelId, stats]) => ({
      model: stats.displayName,
      cost: stats.cost,
      usage: Object.entries(stats.contentTypes)
        .map(([type, count]) => `${count} ${type}`)
        .join('\n'),
      totalRequests: Object.values(stats.contentTypes).reduce((sum, count) => sum + count, 0)
    }));

  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={4}>
        <Box>
          <Typography variant="h4" sx={{ color: 'white', mb: 1 }}>
            Video Analysis Statistics
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.6)' }}>
            Current month
          </Typography>
        </Box>
        <Typography 
          variant="caption" 
          sx={{ 
            color: 'rgba(255, 255, 255, 0.6)', 
            fontSize: '.9rem',
            textAlign: 'right',
            lineHeight: 1.4,
            maxWidth: '680px'
          }}
        >
          Pricing based on <b>On-Demand</b> pricing in the <b>us-west-2</b> region. These are <b>estimates</b>, and only include Amazon Bedrock and Amazon Transcribe analysis costs. Use Cost Explorer for the most accurate pricing.
        </Typography>
      </Box>
      
      {/* Overview Section */}
      <Box mb={4}>
        <Typography variant="h5" sx={{ color: 'white', mb: 3, opacity: 0.9 }}>
          Overview for {new Date().toLocaleString('default', { month: 'long' })}
        </Typography>
        <Box display="flex" gap={3} width="100%">
          <Box flex={1}>
            <StatCard
              title="Total Spend"
              value={`$${totalCost.toFixed(2)}`}
              subtitle="This month"
              icon={<AttachMoneyOutlined />}
              accentColor="#00bcd4"
            />
          </Box>
          <Box flex={1}>
            <StatCard
              title="Videos Processed"
              value={formatNumber(totalVideos)}
              subtitle="Videos analyzed"
              icon={<VideoLibraryOutlined />}
              accentColor="#4caf50"
            />
          </Box>
          <Box flex={1}>
            <StatCard
              title="Total Video Duration"
              value={`${formatNumber(Math.round(totalDuration / 60))} min`}
              subtitle={`${(totalDuration / 3600).toFixed(1)} hours`}
              icon={<AccessTimeOutlined />}
              accentColor="#ff9800"
            />
          </Box>
          {/* <Box flex={1}>
            <StatCard
              title="Total Processing Time"
              value={formatProcessingTime(totalProcessingTime)}
              subtitle="Video + Frame + Transcription"
              icon={<TrendingUpOutlined />}
              accentColor="#e91e63"
            />
          </Box> */}
        </Box>
      </Box>

      <Divider sx={{ mb: 4, borderColor: 'rgba(255, 255, 255, 0.1)' }} />

      {/* Analysis Breakdown and Cost Analysis Side by Side */}
      <Box display="flex" gap={4} mb={4}>
        {/* Analysis Breakdown Section */}
        <Box flex="0 0 25%">
          <Typography variant="h5" sx={{ color: 'white', mb: 3, opacity: 0.9 }}>
            Analysis Breakdown
          </Typography>
          <Box display="flex" flexDirection="column" gap={2}>
            <StatCard
              title="Video Analysis (Amazon Bedrock)"
              value={`$${videoAnalysisCost.toFixed(2)}`}
              subtitle={`${formatNumber(totalVideos)} videos`}
              icon={<VideoLibraryOutlined />}
              accentColor="#00bcd4"
            />
            <StatCard
              title="Frame Analysis (Amazon Bedrock)"
              value={`$${frameAnalysisCost.toFixed(2)}`}
              subtitle={`${formatNumber(frameCount)} frames processed`}
              icon={<PhotoCameraOutlined />}
              accentColor="#ff9800"
            />
            <StatCard
              title="Transcription (Amazon Transcribe)"
              value={`$${transcriptionAnalysisCost.toFixed(2)}`}
              subtitle={`${formatNumber(transcriptionCount)} transcripts`}
              icon={<SubtitlesOutlined />}
              accentColor="#4caf50"
            />

            <StatCard
              title="Agents (Amazon Bedrock)"
              value={`$${agentAnalysisCost.toFixed(2)}`}
              subtitle={`${formatNumber(agentCount)} requests`}
              icon={<AnalyticsOutlined />}
              accentColor="#f44336"
            />
          </Box>
        </Box>

        {/* Vertical Divider */}
        <Divider 
          orientation="vertical" 
          flexItem 
          sx={{ borderColor: 'rgba(255, 255, 255, 0.1)' }} 
        />

        {/* Cost Analysis Section */}
        <Box flex={1} display="flex" flexDirection="column" alignItems="flex-end">
          <Typography variant="h5" sx={{ color: 'white', mb: 3, opacity: 0.9, alignSelf: 'flex-start' }}>
            Model Costs
          </Typography>
          <Box display="flex" flexDirection="column" gap={3} width="100%">
            <Box>
              <SectionCard title="By Model">
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0 }}>
                  {sortedModels.map(({ model, cost, usage, totalRequests }) => (
                    <ModelRow 
                      key={model}
                      model={model} 
                      cost={`$${cost.toFixed(2)}`} 
                      usage={usage}
                      totalRequests={totalRequests}
                    />
                  ))}
                  {sortedModels.length === 0 && (
                    <Typography sx={{ color: 'rgba(255, 255, 255, 0.6)', textAlign: 'center', py: 2, width: '100%' }}>
                      No data available
                    </Typography>
                  )}
                </Box>
              </SectionCard>
            </Box>
            <Box>
              <SectionCard title="By Model Provider">
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0 }}>
                  {sortedProviders.map(({ provider, cost, usage, count }) => (
                    <ModelRow 
                      key={provider}
                      model={provider} 
                      cost={`$${cost.toFixed(2)}`} 
                      usage={`${formatNumber(count)} requests`}
                    />
                  ))}
                  {sortedProviders.length === 0 && (
                    <Typography sx={{ color: 'rgba(255, 255, 255, 0.6)', textAlign: 'center', py: 2, width: '100%' }}>
                      No data available
                    </Typography>
                  )}
                </Box>
              </SectionCard>
            </Box>
          </Box>
        </Box>
      </Box>

      <Divider sx={{ mb: 4, borderColor: 'rgba(255, 255, 255, 0.1)' }} />

      {/* All-Time Statistics Section */}
      <Box mb={4}>
        <Box mb={3}>
          <Typography variant="h5" sx={{ color: 'white', mb: 1, opacity: 0.9 }}>
            Powered by Amazon Bedrock
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.6)' }}>
            Displays all time statistics
          </Typography>
        </Box>
        <Box display="flex" gap={3} width="100%">
          <Box flex={1}>
            <StatCard
              title="Videos Processed"
              value={formatNumber(getUniqueVideosProcessed(allTimeStats[ProcessingType.VIDEO] || []))}
              subtitle={`${formatNumber(Math.round(getUniqueVideoDuration(allTimeStats[ProcessingType.VIDEO] || []) / 60))} min total`}
              icon={<VideoLibraryOutlined />}
              accentColor="#00bcd4"
            />
          </Box>
          <Box flex={1}>
            <StatCard
              title="Frame Analysis"
              value={`$${(allTimeStats[ProcessingType.FRAME]?.reduce((sum, stat) => sum + (stat.inputTokenCost || 0) + (stat.outputTokenCost || 0), 0) || 0).toFixed(2)}`}
              subtitle={`${formatNumber(allTimeStats[ProcessingType.FRAME]?.length || 0)} frames analyzed`}
              icon={<PhotoCameraOutlined />}
              accentColor="#ff9800"
            />
          </Box>
          <Box flex={1}>
            <StatCard
              title="Transcripts Processed"
              value={formatNumber(getUniqueTranscriptsProcessed(allTimeStats[ProcessingType.TRANSCRIPT] || []))}
              subtitle="All time"
              icon={<SubtitlesOutlined />}
              accentColor="#4caf50"
            />
          </Box>
          <Box flex={1}>
            <StatCard
              title="Total Analysis"
              value={formatNumber(Object.values(allTimeStats).reduce((sum, stats) => sum + stats.length, 0))}
              subtitle="All content types"
              icon={<AnalyticsOutlined />}
              accentColor="#e91e63"
            />
          </Box>
        </Box>
      </Box>
      
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
      >
        <Alert severity="error" onClose={() => setSnackbarOpen(false)}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}