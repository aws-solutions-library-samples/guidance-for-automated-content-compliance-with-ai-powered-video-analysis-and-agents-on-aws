import React from 'react';
import { Box, Chip } from '@mui/material';

interface NestedPillProps {
  label: string;
  value: string;
}

export default function NestedPill({ label, value }: NestedPillProps) {
  return (
    <Chip
      label={
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip
            label={label}
            size="small"
            sx={{
              bgcolor: 'rgba(255, 255, 255, 0.2)',
              color: '#ffffff',
              fontSize: '0.75rem',
              height: '20px',
              boxShadow: '2px 4px 18px rgba(0, 0, 0, 0.5)',
              '& .MuiChip-label': {
                px: 1
              }
            }}
          />
          <span style={{ fontWeight: 500 }}>{value}</span>
        </Box>
      }
      size="medium"
      variant="outlined"
      sx={{
        bgcolor: 'rgba(138, 43, 226, 0.5)',
        borderColor: 'rgba(138, 43, 226, 0.5)',
        color: '#ffffff',
        fontSize: '0.875rem',
        '& .MuiChip-label': {
          px: 2
        }
      }}
    />
  );
}