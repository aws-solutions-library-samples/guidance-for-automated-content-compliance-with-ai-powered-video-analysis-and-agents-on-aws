import React from 'react';
import { Box, TextField } from '@mui/material';
import ModelSelector from '../model-selector/model-selector';

interface FrameAnalysisParamsProps {
  modelId: string;
  fps: number;
  onModelChange: (modelId: string) => void;
  onFpsChange: (fps: number) => void;
  filterProviders?: string[];
}

export default function FrameAnalysisParams({ 
  modelId, 
  fps, 
  onModelChange, 
  onFpsChange,
  filterProviders
}: FrameAnalysisParamsProps) {
  return (
    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
      <ModelSelector
        value={modelId}
        onChange={onModelChange}
        label="Analysis Model"
        minWidth={200}
        filterProviders={filterProviders}
      />
      <TextField
        label="Frames Per Second"
        type="number"
        value={fps}
        onChange={(e) => onFpsChange(Number(e.target.value))}
        inputProps={{ min: 0.1, max: 30, step: 0.1 }}
        sx={{ minWidth: 150 }}
      />
    </Box>
  );
}