'use client';

import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import {
  Box,
  Paper,
  Typography
} from '@mui/material';
import Hls from 'hls.js';
import { getUrl } from 'aws-amplify/storage';

interface VideoPlayerProps {
  s3VideoId: string;
  transcript: string;
  title?: string;
}

export interface VideoPlayerRef {
  seekTo: (timestamp: number) => void;
}

const VideoPlayer = forwardRef<VideoPlayerRef, VideoPlayerProps>(({ s3VideoId, transcript, title }, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  useImperativeHandle(ref, () => ({
    seekTo: (timestamp: number) => {
      if (videoRef.current) {
        videoRef.current.currentTime = timestamp;
      }
    }
  }));

  useEffect(() => {
    if (!videoRef.current || !s3VideoId) return;

    const loadVideo = async () => {
      const video = videoRef.current;
      if (!video) return;

      const s3IdWithoutExtension = s3VideoId.split('.')[0];
      
      try {
        const { url } = await getUrl({
          path: ({identityId}) => `processed/video/${identityId}/${s3IdWithoutExtension}/hls/${s3IdWithoutExtension}_640.m3u8`,
          options: {
            validateObjectExistence: true,
            expiresIn: 86400,
          }
        });

        if (Hls.isSupported()) {
          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
            loader: class CustomLoader extends Hls.DefaultConfig.loader {
              //@ts-ignore
              async load(context, config, callbacks) {
                const { type, url } = context;
                
                if (type !== 'manifest' && context.frag) {
                  try {
                    const segment = url.split('/').pop() as string;
                    if (segment) {
                      const { url: presignedUrl } = await getUrl({
                        path: ({identityId}) => `processed/video/${identityId}/${s3IdWithoutExtension}/hls/${segment}`,
                        options: {
                          validateObjectExistence: true,
                          expiresIn: 86400,
                        }
                      });
                      context.url = presignedUrl.toString();
                    }
                  } catch (error) {
                    console.error('Error getting presigned URL for segment:', error);
                  }
                }
                
                return super.load(context, config, callbacks);
              }
            }
          });
          hlsRef.current = hls;
          hls.loadSource(url.toString());
          hls.attachMedia(video);
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = url.toString();
        }
      } catch (error) {
        console.error('Error loading video:', error);
      }
    };

    loadVideo();

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [s3VideoId]);

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 2, minWidth: 'fit-content' }}>
        <Box sx={{ flexShrink: 0, width: 500 }}>
          <video
            ref={videoRef}
            controls
            preload="metadata"
            style={{
              width: '500px',
              height: 'auto'
            }}
          />
        </Box>
        
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <Paper 
            variant="outlined" 
            sx={{ 
              p: 2, 
              maxHeight: '300px',
              overflow: 'auto',
              backgroundColor: '#1a1a2e',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              '&::-webkit-scrollbar': {
                width: '8px',
              },
              '&::-webkit-scrollbar-track': {
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
              },
              '&::-webkit-scrollbar-thumb': {
                backgroundColor: 'rgba(255, 255, 255, 0.3)',
                borderRadius: '4px',
              }
            }}
          >
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold', color: 'white' }}>
              Transcript
            </Typography>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: transcript ? 'white' : 'rgba(255, 255, 255, 0.6)', fontStyle: transcript ? 'normal' : 'italic' }}>
              {transcript || 'No transcript provided or generated for this video.'}
            </Typography>
          </Paper>
        </Box>
      </Box>
    </Box>
  );
});

VideoPlayer.displayName = 'VideoPlayer';

export default VideoPlayer;