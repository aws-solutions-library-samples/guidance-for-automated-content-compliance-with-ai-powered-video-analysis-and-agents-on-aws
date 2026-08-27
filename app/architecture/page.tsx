"use client";

import React from 'react';
import { Box, Typography, Paper, Button, Grid, Card, CardContent, Chip } from '@mui/material';
import { styled } from '@mui/material/styles';
import LaunchIcon from '@mui/icons-material/Launch';
import AccountTreeIcon from '@mui/icons-material/AccountTree';

const StyledPaper = styled(Paper)(({ theme }) => ({
  background: 'linear-gradient(135deg, rgba(138, 43, 226, 0.1) 0%, rgba(0, 188, 212, 0.1) 100%)',
  backdropFilter: 'blur(10px)',
  border: '1px solid rgba(138, 43, 226, 0.2)',
  borderRadius: 16,
  padding: theme.spacing(4),
  marginBottom: theme.spacing(3),
}));

const ServiceCard = styled(Card)(({ theme }) => ({
  background: 'linear-gradient(135deg, rgba(22, 33, 62, 0.8) 0%, rgba(15, 52, 96, 0.8) 100%)',
  backdropFilter: 'blur(10px)',
  border: '1px solid rgba(138, 43, 226, 0.3)',
  borderRadius: 12,
}));

const BlogButton = styled(Button)(({ theme }) => ({
  background: 'linear-gradient(135deg, #8a2be2 0%, #00bcd4 100%)',
  color: 'white',
  padding: '12px 32px',
  fontSize: '1.1rem',
  fontWeight: 600,
  borderRadius: 25,
  textTransform: 'none',
  boxShadow: '0 4px 15px rgba(138, 43, 226, 0.4)',
  '&:hover': {
    background: 'linear-gradient(135deg, #9932cc 0%, #00acc1 100%)',
    transform: 'translateY(-2px)',
    boxShadow: '0 6px 20px rgba(138, 43, 226, 0.6)',
  },
}));

const services = [
  {
    name: 'Amazon Bedrock',
    description: 'Provides foundation models for content analysis, including Amazon Nova for multimodal understanding of video content.',
    usage: 'Analyzes video, still frames, and transcript to detect compliance issues, inappropriate content, used to generate detailed reports. Uses specialized Bedrock Agents for rights validation, quality control, and IMDb metadata enrichment.',
    category: 'AI/ML'
  },
  {
    name: 'AWS Step Functions',
    description: 'Orchestrates the entire compliance workflow as a serverless state machine.',
    usage: 'Coordinates video processing, frame extraction, analysis, and report generation in a reliable, scalable manner.',
    category: 'Orchestration'
  },
  {
    name: 'AWS Lambda',
    description: 'Serverless compute service running the analysis functions.',
    usage: 'Executes video processing, frame analysis, transcript generation, and compliance report creation.',
    category: 'Compute'
  },
  {
    name: 'AWS Elemental MediaConvert',
    description: 'Video processing and transcoding service.',
    usage: 'Converts uploaded videos into standardized formats for HLS playback, and extracts frames at X FPS for use downstream. Triggered by Step Functions workflow and outputs processed video to S3.',
    category: 'Media'
  },
  {
    name: 'Amazon Transcribe',
    description: 'Speech-to-text conversion service.',
    usage: 'Converts audio tracks from videos into timestamped text transcripts, handles multiple languages and audio quality variations.',
    category: 'AI/ML'
  },
  {
    name: 'Amazon S3',
    description: 'Object storage for videos, processed assets, and analysis results.',
    usage: 'Stores uploaded videos, extracted frames, transcripts, and generated compliance reports securely.',
    category: 'Storage'
  },
  {
    name: 'Amazon DynamoDB',
    description: 'NoSQL database for storing analysis metadata and results.',
    usage: 'Tracks analysis jobs, stores compliance results, user sessions, and processing statistics.',
    category: 'Database'
  },
  {
    name: 'AWS AppSync',
    description: 'GraphQL API for real-time data synchronization.',
    usage: 'Provides secure API access for the frontend to query analysis results and job status updates.',
    category: 'API'
  },
  {
    name: 'Amazon Cognito',
    description: 'User authentication and authorization service.',
    usage: 'Manages user sign-up, sign-in, and access control to ensure secure access to the application.',
    category: 'Security'
  },
  {
    name: 'AWS Amplify',
    description: 'Full-stack development platform for building and deploying web applications.',
    usage: 'Hosts the Next.js frontend and provides seamless integration with AWS backend services.',
    category: 'Frontend'
  }
];

const getCategoryColor = (category: string) => {
  const colors = {
    'AI/ML': '#ff6b6b',
    'Orchestration': '#4ecdc4',
    'Compute': '#45b7d1',
    'Storage': '#96ceb4',
    'Database': '#feca57',
    'API': '#ff9ff3',
    'Security': '#54a0ff',
    'Frontend': '#5f27cd',
    'Media': '#e74c3c'
  };
  return colors[category as keyof typeof colors] || '#8a2be2';
};

export default function ArchitecturePage() {
  return (
    <Box sx={{ p: 4, maxWidth: 1200, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, mb: 2 }}>
          <AccountTreeIcon sx={{ fontSize: 40, color: '#8a2be2' }} />
          <Typography variant="h3" sx={{ fontWeight: 700, background: 'linear-gradient(135deg, #8a2be2 0%, #00bcd4 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            System Architecture
          </Typography>
        </Box>
        <Typography variant="h6" sx={{ color: 'rgba(255, 255, 255, 0.8)', maxWidth: 600, mx: 'auto' }}>
          Discover how our content compliance solution leverages AWS services to deliver scalable, intelligent media analysis
        </Typography>
      </Box>

      {/* Architecture Diagram */}
      <StyledPaper>
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 600, mb: 2, color: '#ffffff' }}>
            High-Level Architecture Diagram
          </Typography>
          <Box sx={{ 
            position: 'relative',
            width: '100%',
            height: 'auto',
            borderRadius: 2,
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
          }}>
            <img 
              src="/architecture.jpg"
              alt="Content Compliance Architecture Diagram"
              style={{ 
                width: '100%', 
                height: 'auto',
                display: 'block'
              }}
            />
          </Box>
          <Box sx={{ mt: 3 }}>
            <BlogButton
              variant="contained"
              endIcon={<LaunchIcon />}
              onClick={() => window.open('https://aws.amazon.com/blogs/media/streamlining-content-compliance-automating-media-analysis-with-amazon-nova/', '_blank')}
            >
              View the Blog
            </BlogButton>
          </Box>
        </Box>
      </StyledPaper>

      {/* AWS Services */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 600, mb: 3, color: '#ffffff', textAlign: 'center' }}>
          AWS Services & Components
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {services.map((service, index) => (
            <ServiceCard key={index}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="h6" sx={{ fontWeight: 600, color: '#ffffff' }}>
                    {service.name}
                  </Typography>
                  <Chip 
                    label={service.category}
                    size="small"
                    sx={{ 
                      backgroundColor: '#8a2be2',
                      color: 'white',
                      fontWeight: 500
                    }}
                  />
                </Box>
                <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.8)', mb: 2, lineHeight: 1.6 }}>
                  {service.description}
                </Typography>
                <Box sx={{ 
                  p: 2, 
                  backgroundColor: 'rgba(138, 43, 226, 0.1)', 
                  borderRadius: 1,
                  border: '1px solid rgba(138, 43, 226, 0.2)'
                }}>
                  <Typography variant="caption" sx={{ color: '#8a2be2', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
                    Usage in Architecture
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.9)', mt: 1, lineHeight: 1.5 }}>
                    {service.usage}
                  </Typography>
                </Box>
              </CardContent>
            </ServiceCard>
          ))}
        </Box>
      </Box>
    </Box>
  );
}