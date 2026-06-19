import React from 'react';
import { FormControl, InputLabel, Select, MenuItem, ListSubheader } from '@mui/material';
import { vars } from '../../amplify/global-variables';

interface ModelSelectorProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  minWidth?: number;
  filterProvider?: string;
  filterProviders?: string[];
}

export default function ModelSelector({ value, onChange, label = "Analysis Model", minWidth = 250, filterProvider, filterProviders }: ModelSelectorProps) {
  const filteredModels = filterProvider 
    ? vars.BEDROCK_MODELS.filter(model => model.provider === filterProvider)
    : filterProviders
    ? vars.BEDROCK_MODELS.filter(model => filterProviders.includes(model.provider))
    : vars.BEDROCK_MODELS;
  const modelsByProvider = filteredModels.reduce((acc, model) => {
    if (!acc[model.provider]) {
      acc[model.provider] = [];
    }
    acc[model.provider].push(model);
    return acc;
  }, {} as Record<string, typeof vars.BEDROCK_MODELS>);

  return (
    <FormControl sx={{ minWidth }}>
      <InputLabel>{label}</InputLabel>
      <Select
        value={value}
        label={label}
        onChange={(e) => onChange(e.target.value)}
      >
        {Object.entries(modelsByProvider).map(([provider, models]) => [
          <ListSubheader key={provider} sx={{ bgcolor: 'rgba(0, 0, 0, 0.2)' }}>{provider}</ListSubheader>,
          ...models.map((model) => (
            <MenuItem key={model.id} value={model.id}>
              {model.name}
            </MenuItem>
          ))
        ])}
      </Select>
    </FormControl>
  );
}