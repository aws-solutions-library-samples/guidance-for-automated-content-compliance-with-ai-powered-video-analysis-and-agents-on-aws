"use client";

import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import InfoIcon from '@mui/icons-material/Info';
import WarningIcon from '@mui/icons-material/Warning';
import BugReportIcon from '@mui/icons-material/BugReport';
import TipsAndUpdatesIcon from '@mui/icons-material/TipsAndUpdates';
import BuildIcon from '@mui/icons-material/Build';
import TimelineIcon from '@mui/icons-material/Timeline';

export default function HelpPage() {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Help & Tips
      </Typography>
      <Typography variant="body1" sx={{ mb: 2, color: 'text.secondary' }}>
        Important information, tips, and troubleshooting for the Content Compliance Solution
      </Typography>
      
      <Alert severity="warning" sx={{ mb: 3, '& .MuiAlert-message': { width: '100%' } }}>
        <Typography variant="body1" sx={{ fontWeight: 'bold', mb: 0.5 }}>
          This solution is an accelerator / quick start
        </Typography>
        <Typography variant="body2">
          It is designed to help you quickly upload your videos and see compliance analysis results. There are many nuances and edge cases in content compliance that can be improved upon for production use. For example: segmentation at scene or shot level instead of fixed duration, better merging of segment-level results, and more robust error handling. Use this as a starting point and adapt it to your specific requirements.
        </Typography>
      </Alert>

      {/* Important Tips */}
      <Paper sx={{ mb: 3 }}>
      <Accordion defaultExpanded sx={{ boxShadow: 'none' }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TipsAndUpdatesIcon />
            <Typography variant="h6">Important Tips</Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              For more accurate suggested ratings (e.g. &quot;Teen 13+&quot;), define examples of what each rating level means in the analysis prompt. The default rating system uses generic categories — consider replacing them with well-known industry guidelines for better results.
            </Typography>
          </Alert>
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              Configure analysis models and parameters in the Config page. Each model has different parameter min/max values - selecting values outside the valid range will result in an error when running analysis.
            </Typography>
          </Alert>
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              Select house rating categories to be used for content analysis. You can add custom categories beyond the default ones provided.
            </Typography>
          </Alert>
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              Experiment with the inference parameters on the Config page.
            </Typography>
          </Alert>
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              The Phash Threshold controls sensitivity for detecting duplicate or similar frames. This helps reduce analysis cost and time by avoiding analysis of frames that are too similar.
            </Typography>
          </Alert>
        </AccordionDetails>
      </Accordion>
      </Paper>

      {/* FAQ */}
      <Paper sx={{ mb: 3 }}>
        <Typography variant="h6" sx={{ p: 2, borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>Frequently Asked Questions</Typography>
        
        <Accordion sx={{ boxShadow: 'none' }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography sx={{ fontWeight: 'bold' }}>What models are used for different analysis steps?</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <List dense>
              <ListItem>
                <ListItemIcon sx={{ mr: 2 }}><Chip label="Full Video Analysis" size="small" color="primary" /></ListItemIcon>
                <ListItemText primary="Configurable" />
              </ListItem>
              <ListItem>
                <ListItemIcon sx={{ mr: 2 }}><Chip label="Frame Analysis" size="small" color="primary" /></ListItemIcon>
                <ListItemText primary="Configurable" />
              </ListItem>

              <ListItem>
                <ListItemIcon sx={{ mr: 2 }}><Chip label="QC Agent" size="small" color="primary" /></ListItemIcon>
                <ListItemText primary="Always Nova Lite" />
              </ListItem>
              <ListItem>
                <ListItemIcon sx={{ mr: 2 }}><Chip label="Rights Agent" size="small" color="primary" /></ListItemIcon>
                <ListItemText primary="Always Nova Lite" />
              </ListItem>
              <ListItem>
                <ListItemIcon sx={{ mr: 2 }}><Chip label="IMDb Agent" size="small" color="primary" /></ListItemIcon>
                <ListItemText primary="Always Nova Pro" />
              </ListItem>
              <ListItem>
                <ListItemIcon sx={{ mr: 2 }}><Chip label="Profanity Detection" size="small" color="primary" /></ListItemIcon>
                <ListItemText primary="Always Nova 2 Lite" />
              </ListItem>
              <ListItem>
                <ListItemIcon sx={{ mr: 2 }}><Chip label="JSON Repair Agent" size="small" color="primary" /></ListItemIcon>
                <ListItemText primary="Always Sonnet 4.6" />
              </ListItem>
            </List>
          </AccordionDetails>
        </Accordion>
        
        <Accordion sx={{ boxShadow: 'none' }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography sx={{ fontWeight: 'bold' }}>What video formats are supported?</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body1">
              Only MP4 (.mp4) files are supported. Other container formats such as MOV, MKV, or AVI are not currently supported. While the underlying services (FFmpeg, MediaConvert, Transcribe, Bedrock) can handle other formats, the processing pipeline has format-specific logic that assumes MP4. If you have a video in a different format, please convert it to MP4 before uploading.
            </Typography>
          </AccordionDetails>
        </Accordion>

        <Accordion sx={{ boxShadow: 'none' }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography sx={{ fontWeight: 'bold' }}>How much will it cost for 1 hour of video analysis?</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body1" sx={{ mb: 2 }}>
              <strong>Cost Breakdown:</strong>
            </Typography>
            <List dense>
              <ListItem>
                <ListItemText 
                  primary="Pure video analysis: $0.92/hour (Amazon Nova Pro)"
                  secondary="Video processing without frame analysis"
                />
              </ListItem>
              <ListItem>
                <ListItemText 
                  primary="Frame analysis: may be up to ~80% of total cost"
                  secondary="Analyzed at 1fps by default - can be configured in settings"
                />
              </ListItem>
            </List>
            <Typography variant="body1" sx={{ mb: 2 }}>
              <strong>Cost Variability:</strong>
            </Typography>
            <List dense>
              <ListItem>
                <ListItemText primary="Cost is dynamic and depends on the content of your video. For example, a 5 minute clip of news content will cost less than a 5 minute clip of fast-moving dynamic content, because the pHash optimization filters out similar adjacent frames and reduces the number of frames sent for analysis." />
              </ListItem>
              <ListItem>
                <ListItemText primary="To best estimate the cost with your specific content, upload your file and navigate to the Analysis Cost tab in the analysis results page." />
              </ListItem>
            </List>
            <Typography variant="body1" sx={{ mb: 2 }}>
              <strong>Cost Reduction Options:</strong>
            </Typography>
            <List dense>
              <ListItem>
                <ListItemText primary="• Reduce frame analysis frequency" />
              </ListItem>
              <ListItem>
                <ListItemText primary="• Lower pHash value to choose less frames to analyze" />
              </ListItem>
              <ListItem>
                <ListItemText primary="• Use more cost-effective models" />
              </ListItem>
              <ListItem>
                <ListItemText primary="• Reduce prompt complexity" />
              </ListItem>
              <ListItem>
                <ListItemText primary="• Skip optional features (frame analysis, agents)" />
              </ListItem>
              <ListItem>
                <ListItemText primary="• Evaluate alternative pricing methods — estimates above use On-Demand pricing" />
              </ListItem>
            </List>
          </AccordionDetails>
        </Accordion>

        {/* <Accordion sx={{ boxShadow: 'none' }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography sx={{ fontWeight: 'bold' }}>How is processing time calculated?</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body1">
              Processing time is pure processing time of transcription, model invocations, agent processing, and does not include end to end latency for service invocations, retries, segmentation, and shot generation.
            </Typography>
          </AccordionDetails>
        </Accordion> */}

        <Accordion id="transcript-faq" sx={{ boxShadow: 'none' }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography sx={{ fontWeight: 'bold' }}>How are transcripts handled during analysis?</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body1" sx={{ mb: 1 }}>
              Videos are split into segments (currently 15 minutes each) before analysis. Each segment is paired with its own transcript during the video-level compliance analysis step.
            </Typography>
            <Typography variant="body1" sx={{ mb: 1 }}>
              If no transcript is uploaded, Amazon Transcribe generates one for each segment individually, ensuring each video/transcript pair is aligned and contextually relevant.
            </Typography>
            <Typography variant="body1" sx={{ mb: 1 }}>
              If you upload a transcript, it will only be used when the video fits within a single segment. For longer videos that produce multiple segments, the uploaded transcript is ignored and Amazon Transcribe generates transcripts for each segment instead. This is because the system does not currently split a user-provided transcript by timestamp to match each segment.
            </Typography>
            <Typography variant="body1">
              Note: the 15-minute segment duration is configurable before deployment and may be updated in the future.
            </Typography>
          </AccordionDetails>
        </Accordion>

        <Accordion sx={{ boxShadow: 'none' }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography sx={{ fontWeight: 'bold' }}>How long of a video can I process?</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body1">
              The video-level processing segments the video into 15 minute segments using FFmpeg. This fixed-length segmentation is configurable before deployment (see <code>CHUNK_LENGTH</code> in <code>amplify/python-functions/createChunks/index.py</code>). For production use, consider segmenting based on scene, shot, or chapter level for more meaningful analysis boundaries, especially for long-form content. Multiple-hour long films have been processed successfully.
            </Typography>
          </AccordionDetails>
        </Accordion>

        <Accordion sx={{ boxShadow: 'none' }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography sx={{ fontWeight: 'bold' }}>What media assets are generated?</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body1">
              Amazon Elemental MediaConvert creates HLS playback and thumbnails/frames for further processing. Pillow evalutes the pHash of adjacent images for optimization. Amazon Transcribe creates a transcript if one is not provided. 
            </Typography>
          </AccordionDetails>
        </Accordion>

        <Accordion sx={{ boxShadow: 'none' }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography sx={{ fontWeight: 'bold' }}>Where is it getting the data for rights, quality control, and IMDb?</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body1">
              Right now the agent invokes a Lambda function to get those details, mimicing an API call. The data is provided inline in the Lambda function, for demonstration purposes. This data should be retrieved from an API or a Knowledge Base.
            </Typography>
          </AccordionDetails>
        </Accordion>

        <Accordion sx={{ boxShadow: 'none' }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography sx={{ fontWeight: 'bold' }}>Why does it take so long to process an asset?</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body1">
              Frame analysis runs up to 300 frames concurrently, but processing time depends on your Bedrock model quotas. Models with lower requests-per-minute limits (e.g., Nova 2 Pro Preview at ~100 RPM) will cause retries and longer processing times. The system automatically retries with exponential backoff when throttled. Check your model quotas in the AWS Service Quotas console and consider requesting increases for faster throughput.
            </Typography>
          </AccordionDetails>
        </Accordion>

        <Accordion sx={{ boxShadow: 'none' }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography sx={{ fontWeight: 'bold' }}>Is the pricing accurate?</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body1">
              All pricing is based on On-Demand pricing in the us-west-2 region and attempts to calculate the right cost. This is not a robust production metering system and should not be considered as such. Pricing does not include Amazon S3, Amazon DynamoDB, AWS Lambda, Amazon Elemental MediaConvert, and AWS Step Functions. If you are using a different region or pricing model (e.g., Provisioned Throughput, Batch), actual costs may differ.
            </Typography>
          </AccordionDetails>
        </Accordion>

        <Accordion sx={{ boxShadow: 'none' }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography sx={{ fontWeight: 'bold' }}>What costs are included in the statistics page?</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body1" sx={{ mb: 2 }}>
              The cost statistics shown on the statistics page include:
            </Typography>
            <List dense>
              <ListItem>
                <ListItemText primary="Costs shown are for all videos processed by the current user" />
              </ListItem>
              <ListItem>
                <ListItemText primary="Costs shown on the top section are for the current month only" />
              </ListItem>
              <ListItem>
                <ListItemText primary="Costs on the statistics page include the optional analyses such as agents. In your own deployment, you may choose not to use these features and save on cost" />
              </ListItem>
              <ListItem>
                <ListItemText primary="Costs are blended by different model providers, so if you've run your analyses using different FMs, you can't use this to estimate dollar per minute of video" />
              </ListItem>
            </List>
          </AccordionDetails>
        </Accordion>

        <Accordion sx={{ boxShadow: 'none' }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography sx={{ fontWeight: 'bold' }}>Will processing continue if I leave the page?</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body1">
              Yes, processing happens in the background, and you can find your analysis results in the history page.
            </Typography>
          </AccordionDetails>
        </Accordion>



        <Accordion sx={{ boxShadow: 'none' }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography sx={{ fontWeight: 'bold' }}>Why don't I see the frame analysis pricing / processing time in the analysis cost tab of the analysis results page?</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body1">
              Because frame analysis is not complete when you navigate to the page. Navigate away, and navigate back.
            </Typography>
          </AccordionDetails>
        </Accordion>

        <Accordion sx={{ boxShadow: 'none' }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography sx={{ fontWeight: 'bold' }}>Why is my frame analysis progress stuck?</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body1">
              This is most likely due to Amazon Bedrock throttling in this specific AWS Account due to model quotas.
            </Typography>
          </AccordionDetails>
        </Accordion>

        <Accordion sx={{ boxShadow: 'none' }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography sx={{ fontWeight: 'bold' }}>How does the Mimir integration work?</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body1" sx={{ mb: 1 }}>
              Mimir is a MAM (Media Asset Management) system that supports custom actions. The integration has two directions:
            </Typography>
            <List dense>
              <ListItem>
                <ListItemText 
                  primary="Inbound: Mimir triggers the compliance workflow by sending a custom action request to our API endpoint. The handler kicks off the full analysis pipeline automatically."
                />
              </ListItem>
              <ListItem>
                <ListItemText 
                  primary="Outbound: After analysis, compliance timeline data can be pushed back to Mimir as timed metadata from the Timeline Report tab. The 'Push to Mimir' button only appears for assets that were ingested from Mimir."
                />
              </ListItem>
            </List>
            <Typography variant="body1" sx={{ mb: 1 }}>
              Before deploying, run <code>./scripts/setup-mimir.sh</code> to configure the API key and bearer token in SSM. See the Mimir Integration section in the README for custom action setup details.
            </Typography>
          </AccordionDetails>
        </Accordion>

        <Accordion sx={{ boxShadow: 'none' }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography sx={{ fontWeight: 'bold' }}>I'm getting throttling errors during frame analysis. What should I do?</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body1" sx={{ mb: 1 }}>
              Frame analysis runs up to 300 frames concurrently using a Step Functions Distributed Map. The system includes automatic retry with exponential backoff for throttling errors, but if your account's Bedrock quotas are significantly lower than the concurrency level, retries may cause delays.
            </Typography>
            <Typography variant="body1" sx={{ mb: 1 }}>
              Default requests-per-minute quotas vary by model:
            </Typography>
            <List dense>
              <ListItem>
                <ListItemText primary="Claude Sonnet 4.6 (global): ~10,000 RPM — works well at 300 concurrency" />
              </ListItem>
              <ListItem>
                <ListItemText primary="Nova Pro (cross-region): ~500 RPM — may see some throttling at 300 concurrency" />
              </ListItem>
              <ListItem>
                <ListItemText primary="Nova Lite (cross-region): ~2,000 RPM — works well at 300 concurrency" />
              </ListItem>
              <ListItem>
                <ListItemText primary="Nova 2 Pro Preview: ~100 RPM — will throttle heavily at high concurrency" />
              </ListItem>
            </List>
            <Typography variant="body1" sx={{ mb: 1 }}>
              Check your specific quotas in the AWS Service Quotas console under Amazon Bedrock. Quotas can vary by account.
            </Typography>
            <Typography variant="body1">
              To reduce throttling, lower the <code>maxConcurrency</code> value in <code>amplify/stepFunctions/complianceWorkflow.ts</code> on the <code>AnalyseFramesMap</code> Distributed Map and redeploy. Alternatively, request a quota increase through the Service Quotas console.
            </Typography>
          </AccordionDetails>
        </Accordion>
      </Paper>

      {/* Potential Issues */}
      <Paper sx={{ mb: 3 }}>
      <Accordion sx={{ boxShadow: 'none' }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <BugReportIcon />
            <Typography variant="h6">Potential Issues</Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
              MaxTokens Exceeded Error
            </Typography>
            <Typography variant="body2">
              If maxTokens are exceeded, it will return an error. Try increasing maxTokens in the configuration page.
            </Typography>
          </Alert>

          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
              JSON Decode Error: "Expecting value: line 1 column 1 (char 0)"
            </Typography>
            <Typography variant="body2">
              Most likely a JSON parsing error. There is an Agent to fix JSON, but if it fails, try re-running the analysis, different inference parameters, or a different model.
            </Typography>
          </Alert>

          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
              Read Timeout Error
            </Typography>
            <Typography variant="body2">
              Try re-running the analysis if you receive this error: "Error: Error in compliance analysis: Read timeout on endpoint URL: 'https://bedrock-runtime.us-west-2.amazonaws.com/model/us.amazon.nova-premier-v1%3A0/invoke'"
            </Typography>
          </Alert>
        </AccordionDetails>
      </Accordion>
      </Paper>

      {/* Future Enhancements */}
      <Paper sx={{ mb: 3 }}>
      <Accordion sx={{ boxShadow: 'none' }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TimelineIcon />
            <Typography variant="h6">Future Enhancements</Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Typography component="div">
            <ul style={{ margin: 0, paddingLeft: '20px' }}>
              <li style={{ marginBottom: '8px' }}>Celebrity recognition agent to detect celebrities</li>
              <li style={{ marginBottom: '8px' }}>Automated gate to determine video-level analysis threshold, to conditionally trigger frame-level analysis (right now frame-level analysis always runs)</li>
            </ul>
          </Typography>
        </AccordionDetails>
      </Accordion>
      </Paper>
    </Box>
  );
}