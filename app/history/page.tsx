'use client';

import React, { useEffect, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Box,
  CircularProgress,
  Snackbar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Backdrop,
  Container,
  FormControlLabel,
  Switch,
  Modal
} from '@mui/material';
import { OpenInNew } from '@mui/icons-material';
import { JSONTree } from 'react-json-tree';
import { VideoAnalysisService } from '../../services/video-analysis';
import { LogOutputService } from '../../services/log-output';
import { IVideoAnalysisHistoryResult } from '../../types/video-analysis';
import { fetchAuthSession } from 'aws-amplify/auth';
import { useRouter } from 'next/navigation';

export default function HistoryPage() {
  const [analyses, setAnalyses] = useState<IVideoAnalysisHistoryResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('error');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogContent, setDialogContent] = useState<any>('');
  const [dialogTitle, setDialogTitle] = useState('');
  const [isJsonContent, setIsJsonContent] = useState(false);
  const [showBookmarked, setShowBookmarked] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const loadAnalyses = async () => {
      try {
        const session = await fetchAuthSession();
        const identityId = session.identityId;
        
        if (!identityId) {
          throw new Error('No identity ID found');
        }

        const queryOptions: any = {
          identityId,
          limit: 50
        };

        if (showBookmarked) {
          queryOptions.bookmark = true;
        }

        const data = await VideoAnalysisService.getRecentVideoAnalyses(queryOptions);
        
        setAnalyses(data);
      } catch (err) {
        //@ts-ignore
        setError(err instanceof Error ? err.message : 'Failed to load analyses');
        setSnackbarOpen(true);
      } finally {
        setLoading(false);
      }
    };

    loadAnalyses();
  }, [showBookmarked]);

  // Opening a result is a full-document load in the static export, so returning
  // via the browser Back button can restore this page from the bfcache with the
  // "Loading analysis results..." overlay still visible. Clear it whenever the
  // page is shown or becomes visible again. Mirrors the handling in app/analyze/page.tsx.
  useEffect(() => {
    const clearOverlay = () => setNavigating(false);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') clearOverlay();
    };
    window.addEventListener('pageshow', clearOverlay);
    window.addEventListener('popstate', clearOverlay);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('pageshow', clearOverlay);
      window.removeEventListener('popstate', clearOverlay);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const handleDelete = async (sessionId: string, identityId: string) => {
    setDeleting(true);
    try {
      await Promise.all([
        LogOutputService.deleteLogOutputBySessionId(sessionId, identityId),
        VideoAnalysisService.deleteVideoAnalysis(sessionId)
      ]);
      
      setAnalyses(prev => prev.filter(a => a.sessionId !== sessionId));
      setDeleteConfirmOpen(false);
      setDeletingSessionId(null);
      setSnackbarSeverity('success');
      setError('Analysis deleted successfully');
      setSnackbarOpen(true);
    } catch (err: any) {
      console.error('Error deleting analysis:', err);
      const errorMessage = err?.errors?.[0]?.message || err?.message || 'Failed to delete analysis';
      setSnackbarSeverity('error');
      setError(errorMessage);
      setSnackbarOpen(true);
    } finally {
      setDeleting(false);
    }
  };

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
              Analysis History
            </Typography>
          </Box>
        </Container>
        <Backdrop open={loading} sx={{ zIndex: 9999, flexDirection: 'column', gap: 2 }}>
          <CircularProgress color="inherit" />
          <Typography color="inherit" variant="h6">Loading history...</Typography>
        </Backdrop>
      </>
    );
  }

  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h4">
          Analysis History
        </Typography>
        <FormControlLabel
          control={
            <Switch
              checked={showBookmarked}
              onChange={(e) => setShowBookmarked(e.target.checked)}
              color="primary"
            />
          }
          label="Bookmarked Only"
        />
      </Box>
      <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
        Click on a row to view analysis details. Click on Prompt or Result cells to view full text.
      </Typography>
      
      <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Filename</TableCell>
              <TableCell>Model</TableCell>
              <TableCell>Status</TableCell>
              <TableCell sx={{ width: '150px' }}>Inference</TableCell>
              <TableCell>
                Prompt <OpenInNew sx={{ fontSize: 16, ml: 0.5, opacity: 0.6, verticalAlign: 'middle' }} />
              </TableCell>
              <TableCell sx={{ width: '150px' }}>
                Result <OpenInNew sx={{ fontSize: 16, ml: 0.5, opacity: 0.6, verticalAlign: 'middle' }} />
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {analyses.map((analysis) => {
              const inferenceParams = [
                analysis.inferenceMaxTokens && `Max Tokens: ${analysis.inferenceMaxTokens}`,
                analysis.inferenceTemperature && `Temperature: ${analysis.inferenceTemperature}`,
                analysis.inferenceTopP && `Top P: ${analysis.inferenceTopP}`,
                analysis.inferenceTopK && `Top K: ${analysis.inferenceTopK}`
              ].filter(Boolean).join('\n');

              return (
                <TableRow 
                  key={analysis.sessionId}
                  onClick={() => {
                    setNavigating(true);
                    router.push(`/analyze/analysis-results/${analysis.sessionId}`);
                  }}
                  sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.04)' } }}
                >
                  <TableCell sx={{ fontSize: '0.75rem' }}>
                    <Box>
                      <Box>{new Date(analysis.createdAt).toLocaleDateString()}</Box>
                      <Box sx={{ fontSize: '0.65rem', color: 'text.secondary', opacity: 0.7 }}>
                        {new Date(analysis.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.75rem' }}>{analysis.s3OriginalFilename}</TableCell>
                  <TableCell sx={{ fontSize: '0.75rem' }}>{analysis.bedrockModelId}</TableCell>
                  <TableCell sx={{ fontSize: '0.75rem' }}>{analysis.stopReason}</TableCell>
                  <TableCell sx={{ whiteSpace: 'pre-line', fontSize: '0.75rem' }}>
                    {inferenceParams || 'N/A'}
                  </TableCell>
                  <TableCell 
                    onClick={(e) => {
                      e.stopPropagation();
                      setDialogTitle('Prompt & System Prompt');
                      const promptContent = analysis.prompt || 'N/A';
                      const systemPromptContent = analysis.systemPrompt || 'None';
                      setDialogContent(`Prompt:\n${promptContent}\n\nSystem Prompt:\n${systemPromptContent}`);
                      setIsJsonContent(false);
                      setDialogOpen(true);
                    }}
                    sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'rgba(128, 128, 128, 0.15)' } }}
                  >
                    {analysis.prompt ? analysis.prompt.substring(0, 100) + (analysis.prompt.length > 100 ? '...' : '') : 'N/A'}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDialogTitle('Result');
                          try {
                            const parsedJSON = JSON.parse(analysis.resultRaw || '{}');
                            setDialogContent(parsedJSON.sections || parsedJSON);
                            setIsJsonContent(true);
                          } catch {
                            setDialogContent(analysis.resultJSON || 'N/A');
                            setIsJsonContent(false);
                          }
                          setDialogOpen(true);
                        }}
                        sx={{ borderColor: '#a6e22e', color: '#a6e22e' }}
                      >
                        View Result
                      </Button>
                      <Button
                        variant="text"
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingSessionId(analysis.sessionId);
                          setDeleteConfirmOpen(true);
                        }}
                        sx={{ 
                          color: 'rgba(255, 255, 255, 0.4)',
                          fontSize: '0.7rem',
                          '&:hover': {
                            color: 'rgba(244, 67, 54, 0.8)',
                            backgroundColor: 'rgba(244, 67, 54, 0.05)',
                          }
                        }}
                      >
                        Delete
                      </Button>
                    </Box>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
      
      {analyses.length === 0 && (
        <Box textAlign="center" mt={4}>
          <Typography variant="body1" color="textSecondary">
            No analysis history found
          </Typography>
        </Box>
      )}
      
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{dialogTitle}</DialogTitle>
        <DialogContent>
          {isJsonContent ? (
            <Box sx={{ backgroundColor: '#1e1e1e', padding: 2, borderRadius: 1, overflow: 'auto' }}>
              <JSONTree 
                data={dialogContent}
                shouldExpandNodeInitially={() => true}
                theme={{
                  scheme: 'monokai',
                  author: 'wimer hazenberg (http://www.monokai.nl)',
                  base00: '#272822',
                  base01: '#383830',
                  base02: '#49483e',
                  base03: '#75715e',
                  base04: '#a59f85',
                  base05: '#f8f8f2',
                  base06: '#f5f4f1',
                  base07: '#f9f8f5',
                  base08: '#f92672',
                  base09: '#fd971f',
                  base0A: '#f4bf75',
                  base0B: '#a6e22e',
                  base0C: '#a1efe4',
                  base0D: '#66d9ef',
                  base0E: '#ae81ff',
                  base0F: '#cc6633'
                }}
                invertTheme={false}
              />
            </Box>
          ) : (
            <Box
              component="pre"
              sx={{
                fontFamily: 'monospace',
                fontSize: '0.875rem',
                backgroundColor: '#1e1e1e',
                color: 'white',
                padding: 2,
                borderRadius: 1,
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}
            >
              {typeof dialogContent === 'object' ? JSON.stringify(dialogContent, null, 2) : dialogContent}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
      
      <Backdrop open={navigating} sx={{ zIndex: 9999, flexDirection: 'column', gap: 2 }}>
        <CircularProgress color="inherit" />
        <Typography color="inherit" variant="h6">Loading analysis results...</Typography>
      </Backdrop>
      
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
      >
        <Alert onClose={() => setSnackbarOpen(false)} severity={snackbarSeverity}>
          {error}
        </Alert>
      </Snackbar>
      
      <Modal
        open={deleteConfirmOpen}
        onClose={() => !deleting && setDeleteConfirmOpen(false)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <Box
          sx={{
            maxWidth: '400px',
            width: '90vw',
            bgcolor: 'rgba(26, 26, 46, 0.95)',
            borderRadius: 3,
            p: 3,
            border: '1px solid rgba(244, 67, 54, 0.3)',
            backdropFilter: 'blur(20px)',
            outline: 'none'
          }}
        >
          <Typography variant="h6" sx={{ color: 'white', mb: 2, fontWeight: 'bold' }}>
            Delete Analysis
          </Typography>
          <Typography sx={{ color: 'rgba(255, 255, 255, 0.8)', mb: 3 }}>
            Are you sure you want to delete this analysis? This will remove all associated data including logs and statistics. This action cannot be undone.
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
            <Button
              onClick={() => setDeleteConfirmOpen(false)}
              disabled={deleting}
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
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (deletingSessionId) {
                  const session = await fetchAuthSession();
                  const identityId = session.identityId;
                  if (identityId) {
                    handleDelete(deletingSessionId, identityId);
                  }
                }
              }}
              disabled={deleting}
              sx={{
                backgroundColor: '#f44336',
                color: 'white',
                '&:hover': {
                  backgroundColor: '#d32f2f',
                },
                '&:disabled': {
                  backgroundColor: 'rgba(244, 67, 54, 0.3)',
                  color: 'rgba(255, 255, 255, 0.5)',
                }
              }}
              variant="contained"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </Box>
        </Box>
      </Modal>
    </Box>
  );
}