"use client";
import * as React from "react";
import { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Paper, Snackbar, Alert, Button, Box, Tooltip } from '@mui/material';
import Timeline from '@mui/lab/Timeline';
import TimelineItem from '@mui/lab/TimelineItem';
import TimelineSeparator from '@mui/lab/TimelineSeparator';
import TimelineConnector from '@mui/lab/TimelineConnector';
import TimelineContent from '@mui/lab/TimelineContent';
import TimelineDot from '@mui/lab/TimelineDot';
import TimelineOppositeContent from '@mui/lab/TimelineOppositeContent';
import { ILogMessagesStateReducer } from "../../store/log-output";
import { logMessagesStoreActions } from "../../store/log-output";
import { LogOutputService } from "../../services/log-output";
import { IUserStateReducer } from "../../store/auth";
import { ILogMessageQueryOptions } from "@/types/log-output";

interface LogMessagesProps {
    videoAnalysisWorkflow?: boolean;
    onViewResults?: () => void;
}

export default function LogMessages({ videoAnalysisWorkflow = false, onViewResults }: LogMessagesProps) {
  // get current user from store
  const currentUser = useSelector((state:IUserStateReducer) => {
    return state.authReducer.user
  });
  const dispatch = useDispatch();
  const logMessagesState = useSelector((state:ILogMessagesStateReducer) => {
    return state.logMessagesReducer
  });
  const [isLoading, setIsLoading] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  useEffect(() => {
    if (!currentUser?.identityId || !logMessagesState.sessionId) return;

    setIsLoading(true);

    const fetchMessages = () => {
      const options = {
          sessionId: logMessagesState.sessionId,
          identityId: currentUser?.identityId,
          limit: 50
      } as ILogMessageQueryOptions;
      LogOutputService.getRecentLogMessages(options).then((result) => {
          dispatch(logMessagesStoreActions.setMessages(result));
          setIsLoading(false);
      }).catch((error) => {
          console.log(error);
          setSnackbarMessage(`Failed to fetch log messages: ${error.errors[0].message}`);
          setSnackbarOpen(true);
          setIsLoading(false);
      });
    };

    // Fetch messages immediately
    fetchMessages();

    // Set up interval to fetch messages every 2 seconds
    const intervalId = setInterval(fetchMessages, 2000);

    // Clean up interval on component unmount
    return () => {
      clearInterval(intervalId);
    };
  }, [currentUser?.identityId, logMessagesState.sessionId, dispatch]);
  
  return (
    <Paper elevation={0}>
      {!isLoading && (
        <>
          {logMessagesState.messages.length > 0 ? (
            <Timeline position="right">
              {(() => {
                const uniqueMessages = logMessagesState.messages
                  .filter((message, index, array) => 
                    array.findIndex(m => m.message === message.message) === index
                  );
                return uniqueMessages.reverse().map((message, index) => (
                  <TimelineItem key={`${message?.sessionId}-${message?.createdAt}`}>
                    <TimelineOppositeContent color="text.secondary" sx={{ flex: 0.4, textAlign: 'left' }}>
                      {new Date(message?.createdAt).toLocaleString()}
                      {message?.type?.toLowerCase() !== 'info' && (
                        <>
                          <br />
                          <span style={{ color: 'lightblue' }}><b>{message?.type?.toUpperCase()}</b></span>
                        </>
                      )}
                    </TimelineOppositeContent>
                    <TimelineSeparator>
                      <TimelineDot color={message.type === 'error' ? 'error' : 'primary'} />
                      {index < uniqueMessages.length - 1 && <TimelineConnector />}
                    </TimelineSeparator>
                    <TimelineContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <span>{message?.message}</span>
                        {videoAnalysisWorkflow && 
                         message?.message.includes("General compliance analysis completed successfully") && 
                         logMessagesState.sessionId && onViewResults && (
                          <Tooltip title="View results until the remaining processes complete">
                            <Button
                              variant="outlined"
                              size="small"
                              onClick={onViewResults}
                              sx={{ borderColor: '#a6e22e', color: '#a6e22e', minWidth: 'auto' }}
                            >
                              View Results
                            </Button>
                          </Tooltip>
                        )}

                      </Box>
                    </TimelineContent>
                  </TimelineItem>
                ));
              })()}
            </Timeline>
          ) : (
            <></>
          )}
        </>
      )}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
      >
        <Alert severity="error" onClose={() => setSnackbarOpen(false)}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Paper>
  );
}