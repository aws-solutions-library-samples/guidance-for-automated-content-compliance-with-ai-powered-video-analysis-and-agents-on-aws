'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Snackbar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Grid,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  ListSubheader,
  Checkbox,
  FormControlLabel,
  Chip,
  Stack
} from '@mui/material';
import { ConfigurationService } from '../../services/config';
import ModelSelector from '../../components/model-selector/model-selector';
import { useSelector, useDispatch } from 'react-redux';
import { IConfigStateReducer } from '../../store/config';
import { configStoreActions } from '../../store/config';
import { CONTENT_TYPES, vars, BedrockModality, modelSupportsSamplingParams } from '../../amplify/global-variables';

interface InferenceConfig {
  maxTokens: number;
  topP: number;
  temperature: number;
  topK: number;
}

interface ReportConfig {
  bedrockModelId: string;
  inferenceConfig: InferenceConfig;
  phashThreshold?: number;
}

interface FramesPerSecond {
  [key: string]: number;
}

interface Config {
  houseCategories: string[];
  defaultGeneralReportConfig: ReportConfig;
  defaultDetailedReportConfig: ReportConfig;
  defaultFramesPerSecond: FramesPerSecond;
}

const bedrockModels = vars.BEDROCK_MODELS.map(model => model.id);
const contentTypes = Object.values(CONTENT_TYPES);

export default function ConfigPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });
  const [confirmReset, setConfirmReset] = useState(false);
  const [customCategory, setCustomCategory] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [allAvailableCategories, setAllAvailableCategories] = useState<string[]>([]);
  
  const configService = new ConfigurationService();
  const storeConfig = useSelector((state: IConfigStateReducer) => state.configReducer.config);
  const dispatch = useDispatch();
  
  useEffect(() => {
    const loadConfiguration = async () => {
      let configToUse = storeConfig;
      
      // If no config in store, load it
      if (!configToUse) {
        try {
          const { AuthService } = await import('../../services/auth');
          const identityId = await AuthService.getIdentityId();
          if (identityId) {
            try {
              configToUse = await configService.getCustomConfig(identityId);
              dispatch(configStoreActions.setConfig(configToUse));
            } catch (customError) {
              configToUse = await configService.getDefaultConfig();
              dispatch(configStoreActions.setConfig(configToUse));
            }
          }
        } catch (error) {
          console.error('Error loading configuration:', error);
          return;
        }
      }
      
      if (configToUse) {
        try {
          const defaultConfig = await configService.getDefaultConfig();
          const defaultCategories = defaultConfig.houseCategories || [];
          
          // If configToUse doesn't have houseCategories, use all default categories
          const configCategories = configToUse.houseCategories || defaultCategories;
          //@ts-ignore
          const customCategories = configCategories.filter(cat => !defaultCategories.includes(cat));
          const allCategories = [...defaultCategories, ...customCategories];
          
          // Ensure config has houseCategories property
          const configWithCategories = {
            ...configToUse,
            houseCategories: configCategories
          };
          
          setConfig(configWithCategories);
          setSelectedCategories(configCategories);
          setAllAvailableCategories(allCategories);
        } catch (error) {
          console.error('Error loading default categories:', error);
          setConfig(configToUse);
          setSelectedCategories([]);
          setAllAvailableCategories([]);
        }
      }
    };
    
    loadConfiguration();
  }, [storeConfig, dispatch]);

  if (!config) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
        <Typography>Loading configuration...</Typography>
      </Box>
    );
  }
  
  const handleSave = async () => {
    setSaving(true);
    try {
      const configToSave = {
        ...config,
        houseCategories: selectedCategories
      };
      await configService.saveConfig(configToSave);
      dispatch(configStoreActions.setConfig(configToSave));
      setSnackbar({ open: true, message: 'Configuration saved successfully!', severity: 'success' });
    } catch (error) {
      setSnackbar({ open: true, message: 'Error saving configuration', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };
  
  const handleResetToDefault = () => {
    setConfirmReset(true);
  };
  
  const handleConfirmReset = async () => {
    setConfirmReset(false);
    try {
      await configService.deleteCustomConfig();
    } catch (error) {
      setSnackbar({ open: true, message: 'Error deleting CUSTOM configuration', severity: 'error' });
      return;
    }

    try {
      const defaultConfig = await configService.getDefaultConfig();
      dispatch(configStoreActions.setConfig(defaultConfig));
      setSnackbar({ open: true, message: 'Using DEFAULT configuration file', severity: 'success' });
    } catch(error) {
      setSnackbar({ open: true, message: 'Error resetting to default configuration', severity: 'error' });
    }
  };
  
  const updateReportConfig = (type: 'defaultGeneralReportConfig' | 'defaultDetailedReportConfig', field: string, value: any) => {
    setConfig(prev => {
      if (!prev) return null;
      return {
        ...prev,
        [type]: {
          ...prev[type],
          [field]: value
        }
      };
    });
  };
  
  const updateInferenceConfig = (type: 'defaultGeneralReportConfig' | 'defaultDetailedReportConfig', field: string, value: number) => {
    setConfig(prev => {
      if (!prev) return null;
      return {
        ...prev,
        [type]: {
          ...prev[type],
          inferenceConfig: {
            ...prev[type].inferenceConfig,
            [field]: value
          }
        }
      };
    });
  };
  
  const updateFramesPerSecond = (contentType: string, value: number) => {
    setConfig(prev => {
      if (!prev) return null;
      return {
        ...prev,
        defaultFramesPerSecond: {
          ...prev.defaultFramesPerSecond,
          [contentType]: value
        }
      };
    });
  };

  const updateHouseCategories = (categories: string[]) => {
    setSelectedCategories(categories);
    setConfig(prev => {
      if (!prev) return null;
      return {
        ...prev,
        houseCategories: categories
      };
    });
  };

  const handleCategoryToggle = (category: string) => {
    const newCategories = selectedCategories.includes(category)
      ? selectedCategories.filter(c => c !== category)
      : [...selectedCategories, category];
    updateHouseCategories(newCategories);
  };

  const handleAddCustomCategory = () => {
    if (customCategory.trim() && !allAvailableCategories.includes(customCategory.trim())) {
      const newCategory = customCategory.trim();
      setAllAvailableCategories(prev => [...prev, newCategory]);
      const newCategories = [...selectedCategories, newCategory];
      updateHouseCategories(newCategories);
      setCustomCategory('');
    }
  };

  const handleRemoveCategory = (category: string) => {
    const newCategories = selectedCategories.filter(c => c !== category);
    updateHouseCategories(newCategories);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Compliance Analysis Configuration
      </Typography>
      
      <Paper sx={{ p: 4, mb: 3 }}>
        <Typography variant="h6" gutterBottom sx={{ color: '#b0bec5', mb: 3 }}>
          Rating Configuration
        </Typography>
        <Typography variant="body2" sx={{ mb: 3, fontStyle: 'italic' }}>
          Select the house rating categories to be used for content analysis.
        </Typography>
        
        <Typography variant="subtitle1" sx={{ mb: 2 }}>
          Available Categories:
        </Typography>
        <Grid container spacing={1} sx={{ mb: 3 }}>
          {allAvailableCategories.map(category => (
            <Grid key={category}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={selectedCategories.includes(category)}
                    onChange={() => handleCategoryToggle(category)}
                    size="small"
                  />
                }
                label={category}
                sx={{ '& .MuiFormControlLabel-label': { fontSize: '0.875rem' } }}
              />
            </Grid>
          ))}
        </Grid>
        
        <Typography variant="subtitle1" sx={{ mb: 2 }}>
          Add Custom Categories:
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
          <TextField
            label="Custom Category"
            value={customCategory}
            onChange={(e) => setCustomCategory(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAddCustomCategory()}
            sx={{ flex: 1 }}
          />
          <Button 
            variant="outlined" 
            onClick={handleAddCustomCategory}
            disabled={!customCategory.trim()}
          >
            Add
          </Button>
        </Box>
        
      </Paper>
      
      <Grid container spacing={3}>
        <Grid>
          <Paper sx={{ p: 4, mb: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ color: '#b0bec5', mb: 3 }}>
              General Report Configuration (Full Video Analysis)
            </Typography>
            <Box sx={{ mb: 3 }}>
              <FormControl fullWidth>
                <InputLabel>Bedrock Model</InputLabel>
                <Select
                  value={config.defaultGeneralReportConfig.bedrockModelId}
                  onChange={(e) => {
                    const modelId = e.target.value;
                    updateReportConfig('defaultGeneralReportConfig', 'bedrockModelId', modelId);
                    
                    // Set max tokens to the model's maximum outputTokens
                    const selectedModel = vars.BEDROCK_MODELS.find(m => m.id === modelId);
                    if (selectedModel?.ranges?.outputTokens?.max) {
                      updateInferenceConfig('defaultGeneralReportConfig', 'maxTokens', selectedModel.ranges.outputTokens.max);
                    }
                  }}
                  label="Bedrock Model"
                >
                  {Object.entries(
                    vars.BEDROCK_MODELS
                      .filter(model => (model.provider === 'Amazon' || model.provider === 'Twelve Labs') && model.modalities.includes(BedrockModality.VIDEO) &&
                      model.isDeprecated === false)
                      .reduce((acc, model) => {
                        if (!acc[model.provider]) acc[model.provider] = [];
                        acc[model.provider].push(model);
                        return acc;
                      }, {} as Record<string, typeof vars.BEDROCK_MODELS>)
                  ).map(([provider, models]) => [
                    <ListSubheader key={provider} sx={{ bgcolor: 'rgba(0, 0, 0, 0.2)' }}>{provider}</ListSubheader>,
                    ...models.map(model => (
                      <MenuItem key={model.id} value={model.id}>{model.name}</MenuItem>
                    ))
                  ])}
                </Select>
              </FormControl>
            </Box>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <TextField
                label="Max Tokens"
                type="text"
                inputProps={(() => {
                  const selectedModel = vars.BEDROCK_MODELS.find(m => m.id === config.defaultGeneralReportConfig.bedrockModelId);
                  return selectedModel?.ranges?.outputTokens ? {
                    min: selectedModel.ranges.outputTokens.min,
                    max: selectedModel.ranges.outputTokens.max
                  } : { min: 1 };
                })()}
                value={config.defaultGeneralReportConfig.inferenceConfig.maxTokens.toLocaleString()}
                onChange={(e) => {
                  const numericValue = parseInt(e.target.value.replace(/,/g, ''));
                  if (!isNaN(numericValue)) {
                    updateInferenceConfig('defaultGeneralReportConfig', 'maxTokens', numericValue);
                  }
                }}
                sx={{ flex: 1, minWidth: 120 }}
              />
              {(() => {
                const selectedModel = vars.BEDROCK_MODELS.find(m => m.id === config.defaultGeneralReportConfig.bedrockModelId);
                const isTwelveLabsModel = selectedModel?.provider === 'Twelve Labs';
                
                return (
                  <>
                    <TextField
                      label="Temperature"
                      type="number"
                      inputProps={{ step: 0.1, min: 0.1, max: 1.0 }}
                      value={config.defaultGeneralReportConfig.inferenceConfig.temperature}
                      onChange={(e) => updateInferenceConfig('defaultGeneralReportConfig', 'temperature', parseFloat(e.target.value))}
                      sx={{ flex: 1, minWidth: 120 }}
                    />
                    {!isTwelveLabsModel && (
                      <>
                        <TextField
                          label="Top P"
                          type="number"
                          inputProps={{ step: 0.1, min: 0.1, max: 1.0 }}
                          value={config.defaultGeneralReportConfig.inferenceConfig.topP}
                          onChange={(e) => updateInferenceConfig('defaultGeneralReportConfig', 'topP', parseFloat(e.target.value))}
                          sx={{ flex: 1, minWidth: 100 }}
                        />
                        <TextField
                          label="Top K"
                          type="number"
                          inputProps={{ min: 1 }}
                          value={config.defaultGeneralReportConfig.inferenceConfig.topK}
                          onChange={(e) => updateInferenceConfig('defaultGeneralReportConfig', 'topK', parseInt(e.target.value))}
                          sx={{ flex: 1, minWidth: 100 }}
                        />
                      </>
                    )}
                  </>
                );
              })()}
            </Box>
            <Alert severity="warning" sx={{ mt: 3 }}>
              Each model has different parameter min/max values. Selecting values outside the valid range will result in an error when running the analysis.
            </Alert>
          </Paper>
        </Grid>
        
        <Grid>
          <Paper sx={{ p: 4, mb: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ color: '#b0bec5', mb: 3 }}>
              Detailed Report Configuration (Frame Analysis)
            </Typography>
            <Box sx={{ mb: 3 }}>
              <FormControl fullWidth>
                <InputLabel>Bedrock Model</InputLabel>
                <Select
                  value={config.defaultDetailedReportConfig.bedrockModelId}
                  onChange={(e) => updateReportConfig('defaultDetailedReportConfig', 'bedrockModelId', e.target.value)}
                  label="Bedrock Model"
                >
                  {Object.entries(
                    vars.BEDROCK_MODELS
                      .filter(model => 
                        (model.provider === 'Amazon' || model.provider === 'Anthropic') &&
                        (model.modalities.includes(BedrockModality.VIDEO) || model.modalities.includes(BedrockModality.IMAGE)) &&
                        (model.isDeprecated === false)
                      )
                      .reduce((acc, model) => {
                        if (!acc[model.provider]) acc[model.provider] = [];
                        acc[model.provider].push(model);
                        return acc;
                      }, {} as Record<string, typeof vars.BEDROCK_MODELS>)
                  ).map(([provider, models]) => [
                    <ListSubheader key={provider} sx={{ bgcolor: 'rgba(0, 0, 0, 0.2)' }}>{provider}</ListSubheader>,
                    ...models.map(model => (
                      <MenuItem key={model.id} value={model.id}>{model.name}</MenuItem>
                    ))
                  ])}
                </Select>
              </FormControl>
            </Box>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <TextField
                label="Max Tokens"
                type="number"
                value={config.defaultDetailedReportConfig.inferenceConfig.maxTokens}
                onChange={(e) => updateInferenceConfig('defaultDetailedReportConfig', 'maxTokens', parseInt(e.target.value))}
                sx={{ flex: 1, minWidth: 120 }}
              />
              {modelSupportsSamplingParams(config.defaultDetailedReportConfig.bedrockModelId) && (
                <>
                  <TextField
                    label="Top P"
                    type="number"
                    inputProps={{ step: 0.1, min: 0.1, max: 1.0 }}
                    value={config.defaultDetailedReportConfig.inferenceConfig.topP}
                    onChange={(e) => updateInferenceConfig('defaultDetailedReportConfig', 'topP', parseFloat(e.target.value))}
                    sx={{ flex: 1, minWidth: 100 }}
                  />
                  <TextField
                    label="Temperature"
                    type="number"
                    inputProps={{ step: 0.1, min: 0.1, max: 1.0 }}
                    value={config.defaultDetailedReportConfig.inferenceConfig.temperature}
                    onChange={(e) => updateInferenceConfig('defaultDetailedReportConfig', 'temperature', parseFloat(e.target.value))}
                    sx={{ flex: 1, minWidth: 120 }}
                  />
                  <TextField
                    label="Top K"
                    type="number"
                    inputProps={{ min: 1 }}
                    value={config.defaultDetailedReportConfig.inferenceConfig.topK}
                    onChange={(e) => updateInferenceConfig('defaultDetailedReportConfig', 'topK', parseInt(e.target.value))}
                    sx={{ flex: 1, minWidth: 100 }}
                  />
                </>
              )}
            </Box>
            <Alert severity="warning" sx={{ mt: 3 }}>
              Each model has different parameter min/max values. Selecting values outside the valid range will result in an error when running the analysis.
            </Alert>
            <Typography variant="subtitle1" sx={{ mt: 3, mb: 1 }}>
              Phash Threshold
            </Typography>
            <Typography variant="body2" sx={{ mb: 2, fontStyle: 'italic' }}>
              Controls the sensitivity for detecting duplicate or similar frames. This helps reduce analysis cost and time with analyzing frames that are too similar.
            </Typography>
            <TextField
              label="Phash Threshold"
              type="number"
              inputProps={{ min: 0, max: 100 }}
              value={config.defaultDetailedReportConfig.phashThreshold || 60}
              onChange={(e) => updateReportConfig('defaultDetailedReportConfig', 'phashThreshold', parseInt(e.target.value))}
              sx={{ maxWidth: 200, minWidth: 130 }}
            />
          </Paper>
        </Grid>
      </Grid>
      
      <Paper sx={{ p: 4, mt: 3 }}>
        <Typography variant="h6" gutterBottom sx={{ color: '#b0bec5', mb: 3 }}>
          Default Frames Per Second
        </Typography>
        <Typography variant="body2" sx={{ mb: 3, fontStyle: 'italic' }}>
          Configure the default frame extraction rate for different content types.
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          {contentTypes.map(contentType => (
            <TextField
              key={contentType}
              label={contentType}
              type="number"
              inputProps={{ step: 1, min: 1, max: 3 }}
              value={config.defaultFramesPerSecond[contentType]}
              onChange={(e) => updateFramesPerSecond(contentType, Math.min(3, parseFloat(e.target.value)))}
              sx={{ flex: 1, minWidth: 150 }}
            />
          ))}
        </Box>
      </Paper>
      
      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
        <Button 
          variant="outlined" 
          onClick={handleResetToDefault}
          size="large"
        >
          Reset to Default
        </Button>
        <Button 
          variant="contained" 
          onClick={handleSave}
          disabled={saving}
          size="large"
        >
          {saving ? 'Saving...' : 'Save Configuration'}
        </Button>
      </Box>
      
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
      
      <Dialog open={confirmReset} onClose={() => setConfirmReset(false)}>
        <DialogTitle>Reset Configuration</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to reset all configurations to default values? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmReset(false)}>Cancel</Button>
          <Button onClick={handleConfirmReset} color="primary" variant="contained">
            Reset
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}