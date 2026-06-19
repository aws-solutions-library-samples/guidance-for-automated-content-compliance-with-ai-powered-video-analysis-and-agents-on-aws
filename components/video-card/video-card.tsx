'use client';

import { Card, CardMedia, CardContent, Typography, Box, Chip } from '@mui/material';
import { IMediaLibraryItem } from '@/types/media-library';

interface VideoCardProps {
  item: IMediaLibraryItem;
}

export default function VideoCard({ item }: VideoCardProps) {
  return (
    <Card 
      elevation={8}
      sx={{ 
        width: 320,
        height: 240,
        position: 'relative',
        backgroundImage: `url(${item.imageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        transition: 'transform 0.3s ease-in-out, box-shadow 0.3s ease-in-out',
        '&:hover': {
          transform: 'scale(1.05)',
          boxShadow: '0 8px 25px rgba(0,0,0,0.3)',
          cursor: 'pointer'
        },
        borderRadius: 2,
        overflow: 'hidden'
      }}
    >
      <Chip 
        label={item.size} 
        size="small" 
        sx={{ 
          position: 'absolute',
          top: 8,
          right: 8,
          backgroundColor: 'rgba(255,255,255,0.2)',
          color: 'white',
          textShadow: '1px 1px 2px rgba(0,0,0,0.8)'
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          p: 2,
          background: 'linear-gradient(transparent, rgba(0,0,0,0.7))'
        }}
      >
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <Typography 
            variant="h6" 
            component="div" 
            sx={{ 
              color: 'white',
              textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
              fontWeight: 600,
              fontSize: '1rem',
              lineHeight: 1.2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 1,
              WebkitBoxOrient: 'vertical',
              flex: 1,
              mr: 1
            }}
          >
            {item.originalFilename || item.alt}
          </Typography>
          <Typography 
            variant="body2" 
            sx={{ 
              color: 'white',
              textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
              fontSize: '0.75rem'
            }}
          >
            {item.lastModified.toLocaleDateString()}
          </Typography>
        </Box>
      </Box>
    </Card>
  );
}