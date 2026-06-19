'use client';

import { useState, useEffect } from 'react';
import { Container, Typography, Grid, Box, CircularProgress, Alert, Backdrop, Fab } from '@mui/material';
import { Add } from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { AssetsService } from '@/services/assets';
import { IMediaLibraryItem } from '@/types/media-library';
import VideoCard from '@/components/video-card/video-card';

export default function LibraryPage() {
  const [assets, setAssets] = useState<IMediaLibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const loadAssets = async () => {
      try {
        setLoading(true);
        const mediaItems = await AssetsService.listAssets();
        
        // Sort by most recently uploaded (lastModified descending)
        const sortedItems = mediaItems.sort((a, b) => 
          new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
        );
        
        setAssets(sortedItems);
      } catch (err) {
        console.error('Error loading assets:', err);
        setError('Failed to load media library');
      } finally {
        setLoading(false);
      }
    };

    loadAssets();
  }, []);

  if (loading) {
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
              Media Library
            </Typography>
          </Box>
        </Container>
        <Backdrop open={loading} sx={{ zIndex: 9999, flexDirection: 'column', gap: 2 }}>
          <CircularProgress color="inherit" />
          <Typography color="inherit" variant="h6">Loading library...</Typography>
        </Backdrop>
      </>
    );
  }

  if (error) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  return (
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
          Media Library
        </Typography>
        <Typography variant="h6" color="text.secondary">
          {assets.length} video{assets.length !== 1 ? 's' : ''} available
        </Typography>
      </Box>

      {assets.length === 0 ? (
        <Box 
          display="flex" 
          flexDirection="column" 
          alignItems="center" 
          justifyContent="center" 
          minHeight="40vh"
          textAlign="center"
        >
          <Typography variant="h5" color="text.secondary" sx={{ mb: 2 }}>
            No videos found
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Upload some videos to get started with your media library
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={3}>
          {assets.map((item) => (
            <Grid key={item.s3Id}>
              <VideoCard item={item} />
            </Grid>
          ))}
        </Grid>
      )}
      <Fab 
        color="primary" 
        sx={{ position: 'fixed', bottom: 16, right: 16 }}
        onClick={() => router.push('/')}
      >
        <Add />
      </Fab>
    </Container>
  );
}