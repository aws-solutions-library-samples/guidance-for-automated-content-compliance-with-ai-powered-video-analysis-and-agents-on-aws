import * as stepfunctions from 'aws-cdk-lib/aws-stepfunctions';
import * as stepfunctionsTasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cdk from 'aws-cdk-lib';
import { Names } from 'aws-cdk-lib';
import { Construct } from 'constructs';


interface ComplianceFunctions {
  generatePlaybackAssetsFunction: lambda.Function;
  analyseFrames: lambda.Function;
  generateDetailedComplianceReportFunction: lambda.Function;
  selectFramesForAnalysisFunction: lambda.Function;
  generateTranscriptFunction: lambda.Function;
  createChunksFunction: lambda.Function;
  generateGeneralComplianceReportFunction: lambda.Function;
  runAgentsFunction: lambda.Function;
  stepFunctionFailFunction: lambda.Function;
  analyseChunksFunction: lambda.Function;
  saveWorkflowTimeFunction: lambda.Function;
}

export function createComplianceWorkflow(
  scope: Construct,
  functions: ComplianceFunctions,
  storageBucket: any
): stepfunctions.StateMachine {
  
  const payload = stepfunctions.TaskInput.fromObject({
    s3VideoObjectKey: stepfunctions.JsonPath.stringAt('$.s3VideoObjectKey'),
    bucketName: stepfunctions.JsonPath.stringAt('$.bucketName'),
    bedrockModelId: stepfunctions.JsonPath.stringAt('$.bedrockModelId')
  });

  // Lambda tasks
  const generatePlaybackAssetsTask = new stepfunctionsTasks.LambdaInvoke(scope, 'GeneratePlaybackAssetsTask', {
    lambdaFunction: functions.generatePlaybackAssetsFunction,
    payload: payload,
    resultPath: '$.playbackAssetsResult'
  });

  const analyseFramesTask = new stepfunctionsTasks.LambdaInvoke(scope, 'AnalyseFramesTask', {
    lambdaFunction: functions.analyseFrames
  });

  const analyseFramesMap = new stepfunctions.DistributedMap(scope, 'AnalyseFramesMap', {
    itemReader: new stepfunctions.S3JsonItemReader({
      bucket: storageBucket,
      key: stepfunctions.JsonPath.stringAt('$.selectFramesResult.Payload.selected_frames_for_analysis')
    }),
    maxConcurrency: 300,
    resultPath: stepfunctions.JsonPath.DISCARD
  });

  const generateDetailedComplianceReportTask = new stepfunctionsTasks.LambdaInvoke(scope, 'GenerateDetailedComplianceReportTask', {
    lambdaFunction: functions.generateDetailedComplianceReportFunction,
    payload: payload,
    outputPath: '$.Payload'
  });

  const selectFramesForAnalysisTask = new stepfunctionsTasks.LambdaInvoke(scope, 'SelectFramesForAnalysisTask', {
    lambdaFunction: functions.selectFramesForAnalysisFunction,
    payload: payload,
    resultPath: '$.selectFramesResult'
  });

  const generateTranscriptTask = new stepfunctionsTasks.LambdaInvoke(scope, 'GenerateTranscriptTask', {
    lambdaFunction: functions.generateTranscriptFunction,
    payload: payload,
    resultPath: '$.transcriptResult'
  });


  const createChunksTask = new stepfunctionsTasks.LambdaInvoke(scope, 'CreateChunksTask', {
    lambdaFunction: functions.createChunksFunction,
    payload: payload,
    resultPath: '$.createChunksResult'
  });

  const generateGeneralComplianceReportTask = new stepfunctionsTasks.LambdaInvoke(scope, 'GenerateGeneralComplianceReportTask', {
    lambdaFunction: functions.generateGeneralComplianceReportFunction,
    payload: payload,
    resultPath: '$.generateGeneralComplianceReport',
  });

  const runAgentsTask = new stepfunctionsTasks.LambdaInvoke(scope, 'RunAgentsTask', {
    lambdaFunction: functions.runAgentsFunction,
    payload: payload,
    resultPath: '$.runAgentsResult'
  });

  const stepFunctionFailTask = new stepfunctionsTasks.LambdaInvoke(scope, 'StepFunctionFailTask', {
    lambdaFunction: functions.stepFunctionFailFunction,
    payload: payload,  
  });

  const analyseChunksTask = new stepfunctionsTasks.LambdaInvoke(scope, 'AnalyseChunksTask', {
    lambdaFunction: functions.analyseChunksFunction,
    payload: payload,
    resultPath: '$.analyseChunksResult'
  });

  const saveWorkflowTimeTask = new stepfunctionsTasks.LambdaInvoke(scope, 'SaveWorkflowTimeTask', {
    lambdaFunction: functions.saveWorkflowTimeFunction,
    payload: stepfunctions.TaskInput.fromObject({
      s3VideoObjectKey: stepfunctions.JsonPath.stringAt('$.s3VideoObjectKey'),
      bucketName: stepfunctions.JsonPath.stringAt('$.bucketName'),
      executionStartTime: stepfunctions.JsonPath.stringAt('$$.Execution.StartTime')
    }),
    resultPath: '$.saveWorkflowTimeResult'
  });

  // Wait states
  const waitForAssets = new stepfunctions.Wait(scope, 'WaitForAssets', {
    time: stepfunctions.WaitTime.duration(cdk.Duration.seconds(10))
  });

  const waitForTranscript = new stepfunctions.Wait(scope, 'WaitForTranscript', {
    time: stepfunctions.WaitTime.duration(cdk.Duration.seconds(10))
  });

  // Choice states
  const framesSelectedChoice = new stepfunctions.Choice(scope, 'FramesSelected?')
    .when(
      stepfunctions.Condition.booleanEquals('$.selectFramesResult.Payload.framesSelected', true),
      analyseFramesMap
    )
    .otherwise(
      selectFramesForAnalysisTask
    );

  const assetsGeneratedDone = new stepfunctions.Pass(scope, 'AssetsGeneratedDone');

  const assetsGeneratedChoice = new stepfunctions.Choice(scope, 'AssetsGenerated?')
    .when(
      stepfunctions.Condition.stringEquals('$.playbackAssetsResult.Payload.allAssetsGenerated', 'False'),
      waitForAssets
    )
    .otherwise(
      assetsGeneratedDone
    );

  const chunksAnalysedChoice = new stepfunctions.Choice(scope, 'AllChunksAnalysed?')
    .when(
      stepfunctions.Condition.booleanEquals('$.analyseChunksResult.Payload.allChunksAnalysed', true),
      generateGeneralComplianceReportTask
    )
    .otherwise(
      analyseChunksTask
    );

  const transcriptDone = new stepfunctions.Pass(scope, 'TranscriptDone');

  const transcriptStatusChoice = new stepfunctions.Choice(scope, 'TranscriptStatus?')
    .when(
      stepfunctions.Condition.booleanEquals('$.transcriptResult.Payload.transcriptionComplete', false),
      waitForTranscript
    )
    .otherwise(
      transcriptDone
    );


  // Chain workflow steps
  generatePlaybackAssetsTask.next(assetsGeneratedChoice);
  generateGeneralComplianceReportTask.next(runAgentsTask);
  analyseFramesMap.itemProcessor(analyseFramesTask);
  analyseFramesMap.next(generateDetailedComplianceReportTask);
  selectFramesForAnalysisTask.next(framesSelectedChoice);
  generateTranscriptTask.next(transcriptStatusChoice);
  waitForTranscript.next(generateTranscriptTask);
  analyseChunksTask.next(chunksAnalysedChoice);
  waitForAssets.next(generatePlaybackAssetsTask);

  // Parallel Block 1: MediaConvert asset generation and Transcript generation run concurrently
  const parallelBlock1 = new stepfunctions.Parallel(scope, 'ParallelBlock1', {
    resultPath: '$.parallelBlock1Result'
  })
    .branch(generatePlaybackAssetsTask)
    .branch(generateTranscriptTask);

  // Parallel Block 2: Frame analysis and Chunk analysis run concurrently
  const parallelBlock2 = new stepfunctions.Parallel(scope, 'ParallelBlock2', {
    resultPath: '$.parallelBlock2Result'
  })
    .branch(selectFramesForAnalysisTask)
    .branch(analyseChunksTask);

  // Main workflow definition: CreateChunks → ParallelBlock1 → ParallelBlock2 → SaveWorkflowTime
  const definition = createChunksTask.next(parallelBlock1).next(parallelBlock2).next(saveWorkflowTimeTask);

  parallelBlock1.addCatch(stepFunctionFailTask, {
    errors: ['States.ALL'],
    resultPath: '$.error'
  });

  parallelBlock2.addCatch(stepFunctionFailTask, {
    errors: ['States.ALL'],
    resultPath: '$.error'
  });

  // Create state machine
  const branch = process.env.AWS_BRANCH || 'default';
  const hash = Names.uniqueId(scope).slice(-8);
  return new stepfunctions.StateMachine(scope, 'ComplianceWorkflowStateMachine', {
    definitionBody: stepfunctions.DefinitionBody.fromChainable(definition),
    stateMachineName: `compliance-workflow-${branch}-${hash}`,
  });
}