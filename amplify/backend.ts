import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource.js';
import { data } from './data/resource.js';
import { storage } from './storage/resource.js';
import { Stack, aws_ssm } from "aws-cdk-lib";
import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as stepfunctions from 'aws-cdk-lib/aws-stepfunctions';
import * as stepfunctionsTasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import * as bedrock from 'aws-cdk-lib/aws-bedrock';
import { EventType } from 'aws-cdk-lib/aws-s3';
import { LambdaDestination } from 'aws-cdk-lib/aws-s3-notifications';
import { CommonUtils } from './utils.js';

import {
  Cors,
  RestApi,
  ApiKey,
  CfnUsagePlanKey,
  AwsIntegration,
  CognitoUserPoolsAuthorizer,
} from "aws-cdk-lib/aws-apigateway";
import { addAuthenticatedMethod, addCorsOptions } from './utils/api-auth.js';

import { Policy, PolicyStatement, ManagedPolicy, Effect } from "aws-cdk-lib/aws-iam";
import { vars, PromptLibrary } from './global-variables.js';
import {CustomLambdaConstruct} from './python-functions/resources';
import { createComplianceWorkflow } from './stepFunctions/complianceWorkflow.js';
import { createPolicies, applyLambdaPolicies, applyStepFunctionPolicies, createS3ObjectTaggingPolicy } from './utils/permissions.js';

const AWS_BRANCH = process.env.AWS_BRANCH || 'default';

const backend = defineBackend({
  auth,
  data,
  storage
});

const { cfnUserPool } = backend.auth.resources.cfnResources;
// an empty array denotes "email" and "phone_number" cannot be used as a username
cfnUserPool.usernameAttributes = [];

export const customFunctionsStack = new CustomLambdaConstruct(
  backend.stack,
  vars.APP_PREFIX + "-custom-functions",
);

const mediaConvertRole = new cdk.aws_iam.Role(backend.stack, 'MediaConvertRole', {
  assumedBy: new cdk.aws_iam.ServicePrincipal('mediaconvert.amazonaws.com'),
  managedPolicies: [
    cdk.aws_iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonAPIGatewayInvokeFullAccess'),
    cdk.aws_iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3FullAccess'),
  ],
});

new aws_ssm.StringParameter(backend.stack, 'MediaConvertRoleParam', {
  parameterName: `/${AWS_BRANCH}/MEDIACONVERT_ROLE_ARN`,
  stringValue: mediaConvertRole.roleArn
});

new aws_ssm.StringParameter(backend.stack, 'LogOutputTableParam', {
  parameterName: `/${AWS_BRANCH}/LOG_OUTPUT_TABLE`,
  stringValue: backend.data.resources.tables["LogOutput"].tableName
});

new aws_ssm.StringParameter(backend.stack, 'VideoAnalysisResultsTableParam', {
  parameterName: `/${AWS_BRANCH}/ANALYSIS_RESULTS_TABLE`,
  stringValue: backend.data.resources.tables["VideoAnalysisResults"].tableName
});

new aws_ssm.StringParameter(backend.stack, 'JobStatusTableParam', {
  parameterName: `/${AWS_BRANCH}/JOB_STATUS_TABLE`,
  stringValue: backend.data.resources.tables["JobStatus"].tableName
});

new aws_ssm.StringParameter(backend.stack, 'StatisticsTableParam', {
  parameterName: `/${AWS_BRANCH}/STATISTICS_TABLE`,
  stringValue: backend.data.resources.tables["Statistics"].tableName
});

const cfnAnalyseFrames = customFunctionsStack.node.findChild('analyseFrames') as lambda.Function;
const cfnGeneratePlaybackAssetsFunction = customFunctionsStack.node.findChild('generatePlaybackAssetsFunction') as lambda.Function;
const cfnGenerateGeneralComplianceReportFunction = customFunctionsStack.node.findChild('generateGeneralComplianceReportFunction') as lambda.Function;
const cfnGenerateDetailedComplianceReportFunction = customFunctionsStack.node.findChild('generateDetailedComplianceReportFunction') as lambda.Function;
const cfnGenerateTranscriptFunction = customFunctionsStack.node.findChild('generateTranscriptFunction') as lambda.Function;
const cfnStartComplianceWorkflowFunction = customFunctionsStack.node.findChild('startComplianceWorkflowFunction') as lambda.Function;
const cfnStepFunctionFailFunction = customFunctionsStack.node.findChild('stepFunctionFail') as lambda.Function;
const cfnSelectFramesForAnalysisFunction = customFunctionsStack.node.findChild('selectFramesForAnalysis') as lambda.Function;
const cfnValidateRightsFunction = customFunctionsStack.node.findChild('validateRightsFunction') as lambda.Function;
const cfnRepairJSONFunction = customFunctionsStack.node.findChild('repairJSONFunction') as lambda.Function;
const cfnValidateQCFunction = customFunctionsStack.node.findChild('validateQCFunction') as lambda.Function;
const cfnValidateIMDBFunction = customFunctionsStack.node.findChild('validateIMDBFunction') as lambda.Function;
const cfnRunAgentsFunction = customFunctionsStack.node.findChild('runAgentsFunction') as lambda.Function;
const cfnSaveWorkflowTimeFunction = customFunctionsStack.node.findChild('saveWorkflowTimeFunction') as lambda.Function;
const cfnMimirActionHandlerFunction = customFunctionsStack.node.findChild('mimirActionHandlerFunction') as lambda.Function;
const cfnPushToMimirFunction = customFunctionsStack.node.findChild('pushToMimirFunction') as lambda.Function;

cfnValidateRightsFunction.addPermission('AllowBedrockInvocation', {
  principal: new cdk.aws_iam.ServicePrincipal('bedrock.amazonaws.com'),
  action: 'lambda:InvokeFunction',
  sourceArn: `arn:aws:bedrock:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:agent/*`
});

cfnRepairJSONFunction.addPermission('AllowBedrockInvocation', {
  principal: new cdk.aws_iam.ServicePrincipal('bedrock.amazonaws.com'),
  action: 'lambda:InvokeFunction',
  sourceArn: `arn:aws:bedrock:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:agent/*`
});

cfnValidateQCFunction.addPermission('AllowBedrockInvocation', {
  principal: new cdk.aws_iam.ServicePrincipal('bedrock.amazonaws.com'),
  action: 'lambda:InvokeFunction',
  sourceArn: `arn:aws:bedrock:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:agent/*`
});

cfnValidateIMDBFunction.addPermission('AllowBedrockInvocation', {
  principal: new cdk.aws_iam.ServicePrincipal('bedrock.amazonaws.com'),
  action: 'lambda:InvokeFunction',
  sourceArn: `arn:aws:bedrock:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:agent/*`
});

// Create Bedrock Agent Role
const bedrockAgentRole = new cdk.aws_iam.Role(backend.stack, 'BedrockAgentRole', {
  assumedBy: new cdk.aws_iam.ServicePrincipal('bedrock.amazonaws.com'),
  inlinePolicies: {
    BedrockFoundationModelPolicy: new cdk.aws_iam.PolicyDocument({
      statements: [
        new PolicyStatement({
          sid: 'AmazonBedrockAgentBedrockFoundationModelPolicyProd',
          effect: Effect.ALLOW,
          actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
          resources: [`arn:aws:bedrock:*::foundation-model/*`] // make sure region is * since we are using cross region inference
        }),
        new PolicyStatement({
          sid: 'AmazonBedrockAgentBedrockFoundationModelPolicyInfProd',
          effect: Effect.ALLOW,
          actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
          resources: [`arn:aws:bedrock:*:${cdk.Aws.ACCOUNT_ID}:inference-profile/*`] // make sure region is * since we are using cross region inference
        }),
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ['lambda:InvokeFunction'],
          resources: [cfnValidateRightsFunction.functionArn]
        }),
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ['lambda:InvokeFunction'],
          resources: [cfnRepairJSONFunction.functionArn]
        }),
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ['lambda:InvokeFunction'],
          resources: [cfnValidateQCFunction.functionArn]
        }),
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ['lambda:InvokeFunction'],
          resources: [cfnValidateIMDBFunction.functionArn]
        })
      ]
    })
  }
});

bedrockAgentRole.assumeRolePolicy?.addStatements(
  new PolicyStatement({
    sid: 'AmazonBedrockAgentBedrockFoundationModelPolicyProd',
    effect: Effect.ALLOW,
    principals: [new cdk.aws_iam.ServicePrincipal('bedrock.amazonaws.com')],
    actions: ['sts:AssumeRole'],
    conditions: {
      StringEquals: {
        'aws:SourceAccount': cdk.Aws.ACCOUNT_ID
      },
      ArnLike: {
        'aws:SourceArn': `arn:aws:bedrock:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:agent/*`
      }
    }
  })
);

// Create Bedrock Rights Agent
const rightsAgent = new bedrock.CfnAgent(backend.stack, 'RightsAgent', {
  agentName: CommonUtils.getUniqueResourceNameForEnv('rights-agent'),
  description: `A media rights agent with access to asset rights data. Updated: ${new Date().toISOString()}`,
  agentResourceRoleArn: bedrockAgentRole.roleArn,
  autoPrepare: true,
  foundationModel: 'us.amazon.nova-lite-v1:0',
  idleSessionTtlInSeconds: 60,
  instruction: PromptLibrary.RIGHTS_AGENT_INSTRUCTION_PROMPT,
  actionGroups: [{
    actionGroupName: 'RightsActions',
    description: 'Action group for media rights functions',
    actionGroupExecutor: {
      lambda: cfnValidateRightsFunction.functionArn
    },
    apiSchema: {
      payload: JSON.stringify({
        openapi: '3.0.0',
        info: {
          title: 'Rights API',
          version: '1.0.1',
          description: 'API to validate media asset rights and clearance status.'
        },
        paths: {
          '/validate-rights': {
            post: {
              summary: 'Validate rights and clearance status for a media asset.',
              description: 'Validates rights and clearance status for a specific asset ID and usage type.',
              operationId: 'validateRights',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        filename: {
                          type: 'string',
                          description: 'The file name to validate rights for'
                        },
                        usageType: {
                          type: 'string',
                          description: 'The type of usage to validate (e.g., standard, demo, commercial)',
                          default: 'standard'
                        }
                      },
                      required: ['filename']
                    }
                  }
                }
              },
              responses: {
                '200': {
                  description: 'Rights validation results',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          asset_verified: {
                            type: 'boolean',
                            description: 'Whether the asset exists in MAM manifest'
                          },
                          filename: {
                            type: 'string',
                            description: 'The validated filename'
                          },
                          rights_status: {
                            type: 'object',
                            description: 'Rights and clearance information'
                          },
                          contacts: {
                            type: 'object',
                            description: 'Contact information for rights holders'
                          },
                          warnings: {
                            type: 'array',
                            description: 'Any warnings or issues found'
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      })
    }
  }]
});

// Create Bedrock Agent Alias
const rightsAgentAlias = new bedrock.CfnAgentAlias(backend.stack, 'RightsAgentAlias', {
  agentId: rightsAgent.attrAgentId,
  agentAliasName: 'RightsAgentAlias',
  description: `Alias for the Rights Agent - Updated: ${new Date().toISOString()}`
});

// Create SSM parameters for agent IDs
new cdk.aws_ssm.StringParameter(backend.stack, 'RightsAgentIdParameter', {
  parameterName: `/${AWS_BRANCH}/RIGHTS_AGENT_ID`,
  stringValue: rightsAgent.attrAgentId
});

new cdk.aws_ssm.StringParameter(backend.stack, 'RightsAgentAliasIdParameter', {
  parameterName: `/${AWS_BRANCH}/RIGHTS_AGENT_ALIAS_ID`,
  stringValue: rightsAgentAlias.attrAgentAliasId
});

// Create Bedrock Repair JSON Agent
const repairJsonAgent = new bedrock.CfnAgent(backend.stack, 'RepairJsonAgent', {
  agentName: CommonUtils.getUniqueResourceNameForEnv('repair-json'),
  description: `A JSON repair agent for fixing malformed JSON. Updated: ${new Date().toISOString()}`,
  agentResourceRoleArn: bedrockAgentRole.roleArn,
  autoPrepare: true,
  foundationModel: 'us.anthropic.claude-sonnet-4-6',
  idleSessionTtlInSeconds: 60,
  instruction: PromptLibrary.REPAIR_JSON_AGENT_INSTRUCTION_PROMPT,
  actionGroups: [{
    actionGroupName: 'RepairJsonActions',
    description: 'Action group for JSON repair functions',
    actionGroupExecutor: {
      lambda: cfnRepairJSONFunction.functionArn
    },
    apiSchema: {
      payload: JSON.stringify({
        openapi: '3.0.0',
        info: {
          title: 'Repair JSON API',
          version: '1.0.0',
          description: 'API to repair malformed JSON data.'
        },
        paths: {
          '/repair-json': {
            post: {
              summary: 'Repair malformed JSON data.',
              description: 'Attempts to fix and validate malformed JSON strings.',
              operationId: 'repairJson',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        jsonString: {
                          type: 'string',
                          description: 'The malformed JSON string to repair'
                        }
                      },
                      required: ['jsonString']
                    }
                  }
                }
              },
              responses: {
                '200': {
                  description: 'JSON repair results',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          repairedJson: {
                            type: 'object',
                            description: 'The repaired JSON object'
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      })
    }
  }]
});

// Create Bedrock Agent Alias for Repair JSON
const repairJsonAgentAlias = new bedrock.CfnAgentAlias(backend.stack, 'RepairJsonAgentAlias', {
  agentId: repairJsonAgent.attrAgentId,
  agentAliasName: 'RepairJsonAgentAlias',
  description: `Alias for the Repair JSON Agent - Updated: ${new Date().toISOString()}`
});

// Create SSM parameters for repair JSON agent IDs
new cdk.aws_ssm.StringParameter(backend.stack, 'RepairJsonAgentIdParameter', {
  parameterName: `/${AWS_BRANCH}/REPAIR_JSON_AGENT_ID`,
  stringValue: repairJsonAgent.attrAgentId
});

new cdk.aws_ssm.StringParameter(backend.stack, 'RepairJsonAgentAliasIdParameter', {
  parameterName: `/${AWS_BRANCH}/REPAIR_JSON_AGENT_ALIAS_ID`,
  stringValue: repairJsonAgentAlias.attrAgentAliasId
});

// Create Bedrock QC Agent
const qcAgent = new bedrock.CfnAgent(backend.stack, 'QCAgent', {
  agentName: CommonUtils.getUniqueResourceNameForEnv('qc-agent'),
  description: `A quality control agent for language validation. Updated: ${new Date().toISOString()}`,
  agentResourceRoleArn: bedrockAgentRole.roleArn,
  autoPrepare: true,
  foundationModel: 'us.amazon.nova-lite-v1:0',
  idleSessionTtlInSeconds: 60,
  instruction: PromptLibrary.QC_AGENT_INSTRUCTION_PROMPT,
  actionGroups: [{
    actionGroupName: 'QCActions',
    description: 'Action group for quality control functions',
    actionGroupExecutor: {
      lambda: cfnValidateQCFunction.functionArn
    },
    apiSchema: {
      payload: JSON.stringify({
        openapi: '3.0.0',
        info: {
          title: 'QC API',
          version: '1.0.0',
          description: 'API to validate language consistency for media assets.'
        },
        paths: {
          '/validate-qc': {
            post: {
              summary: 'Validate language consistency for a media asset filename.',
              description: 'Validates language consistency between filename and expected content language.',
              operationId: 'validateQC',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        filename: {
                          type: 'string',
                          description: 'The original filename to validate language consistency for'
                        },
                        detected_language: {
                          type: 'string',
                          description: 'The language detected from transcription analysis',
                          default: 'EN-US'
                        }
                      },
                      required: ['filename']
                    }
                  }
                }
              },
              responses: {
                '200': {
                  description: 'QC validation results',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          qc_status: {
                            type: 'string',
                            description: 'QC status (PASS/FAIL/WARNING/REVIEW_REQUIRED)'
                          },
                          filename_language: {
                            type: 'string',
                            description: 'Language detected from filename'
                          },
                          content_language: {
                            type: 'string',
                            description: 'Expected content language'
                          },
                          validation_method: {
                            type: 'string',
                            description: 'The method used to validate (e.g. transcription)'
                          },
                          confidence: {
                            type: 'number',
                            description: 'Confidence score for the validation'
                          },
                          issues: {
                            type: 'array',
                            description: 'List of issues found'
                          },
                          summary: {
                            type: 'string',
                            description: 'Summary of validation results'
                          },
                          recommendations: {
                            type: 'array',
                            description: 'Recommendations for fixing issues'
                          },
                          analysis_metadata: {
                            type: 'object',
                            description: 'Additional metadata about the analysis',
                            properties: {
                              content_confidence: {
                                type: 'number',
                                description: 'Confidence score for content analysis'
                              },
                              filename_confidence: {
                                type: 'number',
                                description: 'Confidence score for filename analysis'
                              },
                              validation_source: {
                                type: 'string',
                                description: 'Description of the validation source'
                              },
                              language_match: {
                                type: 'boolean',
                                description: 'Whether filename and content languages match'
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      })
    }
  }]
});

// Create Bedrock Agent Alias for QC
const qcAgentAlias = new bedrock.CfnAgentAlias(backend.stack, 'QCAgentAlias', {
  agentId: qcAgent.attrAgentId,
  agentAliasName: 'QCAgentAlias',
  description: `Alias for the QC Agent - Updated: ${new Date().toISOString()}`
});

// Create SSM parameters for QC agent IDs
new cdk.aws_ssm.StringParameter(backend.stack, 'QCAgentIdParameter', {
  parameterName: `/${AWS_BRANCH}/QC_AGENT_ID`,
  stringValue: qcAgent.attrAgentId
});

new cdk.aws_ssm.StringParameter(backend.stack, 'QCAgentAliasIdParameter', {
  parameterName: `/${AWS_BRANCH}/QC_AGENT_ALIAS_ID`,
  stringValue: qcAgentAlias.attrAgentAliasId
});

// Create Bedrock IMDB Agent
const imdbAgent = new bedrock.CfnAgent(backend.stack, 'IMDBAgent', {
  agentName: CommonUtils.getUniqueResourceNameForEnv('imdb-agent'),
  description: `An IMDB validation agent for media asset verification. Updated: ${new Date().toISOString()}`,
  agentResourceRoleArn: bedrockAgentRole.roleArn,
  autoPrepare: true,
  foundationModel: 'us.amazon.nova-pro-v1:0',
  idleSessionTtlInSeconds: 60,
  instruction: PromptLibrary.IMDB_AGENT_INSTRUCTION_PROMPT,
  actionGroups: [{
    actionGroupName: 'IMDBActions',
    description: 'Action group for IMDB validation functions',
    actionGroupExecutor: {
      lambda: cfnValidateIMDBFunction.functionArn
    },
    apiSchema: {
      payload: JSON.stringify({
        openapi: '3.0.0',
        info: {
          title: 'IMDB API',
          version: '1.0.0',
          description: 'API to validate IMDB information for media assets.'
        },
        paths: {
          '/validate-imdb': {
            post: {
              summary: 'Validate IMDB information for a media asset.',
              description: 'Validates IMDB data with compliance analysis results for a file and retrieves associated metadata for verification.',
              operationId: 'validateIMDB',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        filename: {
                          type: 'string',
                          description: 'The filename to validate against IMDB data'
                        }
                      },
                      required: ['filename']
                    }
                  }
                }
              },
              responses: {
                '200': {
                  description: 'IMDB validation results',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          title: {
                            type: 'string',
                            description: 'Title of the media'
                          },
                          season: {
                            type: 'number',
                            description: 'Season number (if applicable)'
                          },
                          episode: {
                            type: 'number',
                            description: 'Episode number (if applicable)'
                          },
                          imdb_id: {
                            type: 'string',
                            description: 'The IMDB ID'
                          },
                          parentsGuide: {
                            type: 'array',
                            description: 'Parents guide categories',
                            items: {
                              type: 'object',
                              properties: {
                                category: {
                                  type: 'string',
                                  description: 'Category name (e.g., Violence & Gore, Sex & Nudity)'
                                },
                                severity: {
                                  type: 'string',
                                  description: 'Severity level (None, Mild, Moderate, Severe)'
                                },
                                votes: {
                                  type: 'object',
                                  properties: {
                                    noneVotes: { type: 'number' },
                                    mildVotes: { type: 'number' },
                                    moderateVotes: { type: 'number' },
                                    severeVotes: { type: 'number' }
                                  }
                                },
                                parentsGuideItems: {
                                  type: 'array',
                                  items: {
                                    type: 'object',
                                    properties: {
                                      text: { type: 'string' },
                                      isSpoiler: { type: 'boolean' }
                                    }
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      })
    }
  }]
});

// Create Bedrock Agent Alias for IMDB
const imdbAgentAlias = new bedrock.CfnAgentAlias(backend.stack, 'IMDBAgentAlias', {
  agentId: imdbAgent.attrAgentId,
  agentAliasName: 'IMDBAgentAlias',
  description: `Alias for the IMDB Agent - Updated: ${new Date().toISOString()}`
});

// Create SSM parameters for IMDB agent IDs
new cdk.aws_ssm.StringParameter(backend.stack, 'IMDBAgentIdParameter', {
  parameterName: `/${AWS_BRANCH}/IMDB_AGENT_ID`,
  stringValue: imdbAgent.attrAgentId
});

new cdk.aws_ssm.StringParameter(backend.stack, 'IMDBAgentAliasIdParameter', {
  parameterName: `/${AWS_BRANCH}/IMDB_AGENT_ALIAS_ID`,
  stringValue: imdbAgentAlias.attrAgentAliasId
});





// Create Step Function for compliance workflow
const complianceWorkflowStateMachine = createComplianceWorkflow(backend.stack, {
  generatePlaybackAssetsFunction: cfnGeneratePlaybackAssetsFunction,
  analyseFrames: cfnAnalyseFrames,
  generateDetailedComplianceReportFunction: cfnGenerateDetailedComplianceReportFunction,
  selectFramesForAnalysisFunction: cfnSelectFramesForAnalysisFunction,
  generateTranscriptFunction: cfnGenerateTranscriptFunction,
  createChunksFunction: customFunctionsStack.node.findChild('createChunks') as lambda.Function,
  generateGeneralComplianceReportFunction: cfnGenerateGeneralComplianceReportFunction,
  runAgentsFunction: cfnRunAgentsFunction,
  stepFunctionFailFunction: cfnStepFunctionFailFunction,
  analyseChunksFunction: customFunctionsStack.node.findChild('analyseChunks') as lambda.Function,
  saveWorkflowTimeFunction: cfnSaveWorkflowTimeFunction
}, backend.storage.resources.bucket);

new aws_ssm.StringParameter(backend.stack, 'WorkflowStepFunctionARNParam', {
  parameterName: `/${AWS_BRANCH}/STEP_FUNCTION_ARN`,
  stringValue: complianceWorkflowStateMachine.stateMachineArn
});



backend.data.resources.cfnResources.amplifyDynamoDbTables["LogOutput"].timeToLiveAttribute = {
  attributeName: "ttl",
  enabled: true,
};

const s3Bucket = backend.storage.resources.bucket;
const cfnBucket = s3Bucket.node.defaultChild as s3.CfnBucket;
const customMetadataPrefix = 'x-amz-meta-';

s3Bucket.addEventNotification(
  EventType.OBJECT_CREATED,
  new LambdaDestination(cfnStartComplianceWorkflowFunction),
  {
    prefix: `${vars.API_PATHS.VIDEO_ASSETS}/`,
  }
);

// update the s3 cors policy to add custom headers in the exposed headers configuration
cfnBucket.addPropertyOverride('CorsConfiguration', {
  CorsRules: [
    {
      ExposedHeaders: [`${customMetadataPrefix}${vars.S3_CUSTOM_METADATA.originalfilename}`, 'ETag', 'x-amz-server-side-encryption', 'x-amz-request-id', 'x-amz-id-2'],
      AllowedHeaders: ['*'],
      AllowedMethods: ['GET', 'HEAD', 'PUT', 'POST', 'DELETE'],
      AllowedOrigins: ['*'],
      // MaxAgeSeconds: 3000,
    }
  ]
});

const appPrefix = vars.APP_PREFIX;

const apiStack = backend.createStack(appPrefix + "-api-stack");

const restAPI = new RestApi(apiStack, "RestApi", {
  restApiName: `${appPrefix}-rest-api-${process.env.AWS_BRANCH}`,
  deploy: true,
  deployOptions: {
    stageName: process.env.AWS_BRANCH,
  },
});

// Apply permissions — S3 scoped via static wildcard pattern, DynamoDB scoped to specific tables
const policies = createPolicies({
  tableNames: ["LogOutput", "VideoAnalysisResults", "Statistics", "JobStatus"].map(
    name => backend.data.resources.tables[name].tableName
  ),
});
const s3ObjectTaggingPolicy = createS3ObjectTaggingPolicy(apiStack);

// Apply policies to step function
applyStepFunctionPolicies(complianceWorkflowStateMachine, policies);

// Apply policies to all lambda functions
const lambdaFunctions = customFunctionsStack.node.findAll()
  .filter(node => node instanceof lambda.Function) as lambda.Function[];

applyLambdaPolicies(lambdaFunctions, policies);

// Set environment and additional policies
lambdaFunctions.forEach(fn => fn.addEnvironment('AWS_BRANCH', AWS_BRANCH));
cfnStartComplianceWorkflowFunction.addToRolePolicy(policies.stepFunctions);
backend.auth.resources.authenticatedUserIamRole.attachInlinePolicy(s3ObjectTaggingPolicy);

// Create IAM role for API Gateway S3 integration
const apiGatewayS3ConfigRole = new cdk.aws_iam.Role(apiStack, 'ApiGatewayS3ConfigRole', {
  assumedBy: new cdk.aws_iam.ServicePrincipal('apigateway.amazonaws.com'),
  inlinePolicies: {
    S3Access: new cdk.aws_iam.PolicyDocument({
      statements: [
        new PolicyStatement({
          actions: ['s3:GetObject'],
          resources: [`${s3Bucket.bucketArn}/config/*/config.json`],
        }),
      ],
    }),
  },
});

// Create S3 integration for getting config.json
const s3Integration = new AwsIntegration({
  service: 's3',
  integrationHttpMethod: 'GET',
  path: `${s3Bucket.bucketName}/config/{identityId}/config.json`,
  options: {
    credentialsRole: apiGatewayS3ConfigRole,
    requestParameters: {
      'integration.request.path.identityId': 'method.request.path.identityId',
    },
    integrationResponses: [
      {
        statusCode: '200',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Origin': "'*'",
          'method.response.header.Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
          'method.response.header.Access-Control-Allow-Methods': "'GET,OPTIONS'",
        },
      },
    ],
  },
});

// Cognito authorizer for all API Gateway methods
const cognitoAuthorizer = new CognitoUserPoolsAuthorizer(apiStack, 'CognitoAuthorizer', {
  cognitoUserPools: [backend.auth.resources.userPool],
});

// Add config resource and method
const configResource = restAPI.root.addResource('custom-config');
const identityResource = configResource.addResource('{identityId}');

// Add OPTIONS method for CORS preflight (unauthenticated)
addCorsOptions(identityResource, { allowMethods: "'GET,OPTIONS'" });

// Add GET method with Cognito auth
addAuthenticatedMethod({
  resource: identityResource,
  httpMethod: 'GET',
  integration: s3Integration,
  authorizer: cognitoAuthorizer,
  methodOptions: {
    requestParameters: {
      'method.request.path.identityId': true,
    },
    methodResponses: [
      {
        statusCode: '200',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Origin': true,
          'method.response.header.Access-Control-Allow-Headers': true,
          'method.response.header.Access-Control-Allow-Methods': true,
        },
      },
    ],
  },
});

// ============================================================
// MIMIR Integration — Custom Action Handler for external MAM
// ============================================================

// Set destination bucket and grant S3 permissions for MIMIR handler
cfnMimirActionHandlerFunction.addEnvironment('DESTINATION_BUCKET', s3Bucket.bucketName);
// Mimir API config for resolving item S3 locations when not in the payload
cfnMimirActionHandlerFunction.addEnvironment('MIMIR_API_URL', 'https://us.mjoll.no/api/v1');
cfnMimirActionHandlerFunction.addEnvironment('MIMIR_API_TOKEN_PARAM', `/shared/MIMIR_API_TOKEN`);
cfnMimirActionHandlerFunction.addToRolePolicy(new PolicyStatement({
  effect: Effect.ALLOW,
  actions: ['ssm:GetParameter'],
  resources: [`arn:aws:ssm:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:parameter/shared/MIMIR_API_TOKEN`],
}));
cfnMimirActionHandlerFunction.addToRolePolicy(new PolicyStatement({
  effect: Effect.ALLOW,
  actions: ['s3:PutObject', 's3:PutObjectTagging'],
  resources: [`${s3Bucket.bucketArn}/${vars.API_PATHS.VIDEO_ASSETS}/*`],
}));

// Create Lambda integration for MIMIR action handler
// allowTestInvoke: false prevents CDK from adding an overly broad
// "test-invoke-stage/*" resource-based policy on the Lambda, which
// Palisade flags as world-accessible (Risk ID 48d3c518).
const mimirActionLambdaIntegration = new cdk.aws_apigateway.LambdaIntegration(cfnMimirActionHandlerFunction, {
  proxy: true,
  allowTestInvoke: false,
});

// Add MIMIR custom-action API resource
const mimirActionResource = restAPI.root.addResource('mimir-action');

// Add OPTIONS method for CORS preflight (unauthenticated)
addCorsOptions(mimirActionResource, { allowMethods: "'POST,OPTIONS'" });

// API key auth for MIMIR inbound endpoint (Mimir sends x-api-key header)
// The API key is created once per account (via setup-mimir.sh) and shared across branches.
// Each branch imports it by ID from /shared/MIMIR_API_KEY_ID in SSM.
// For fresh accounts, run setup-mimir.sh before the first deploy.
const mimirApiKeyId = aws_ssm.StringParameter.valueForStringParameter(
  apiStack, '/shared/MIMIR_API_KEY_ID'
);
const mimirApiKey = ApiKey.fromApiKeyId(apiStack, 'MimirApiKey', mimirApiKeyId);

const apiStackHash = cdk.Names.uniqueId(apiStack).slice(-8);

const mimirUsagePlan = restAPI.addUsagePlan('MimirUsagePlan', {
  name: `mimir-action-plan-${AWS_BRANCH}-${apiStackHash}`,
  apiStages: [{
    api: restAPI,
    stage: restAPI.deploymentStage,
  }],
});

// Use CfnUsagePlanKey with a stable logical ID to avoid duplicate key-stage
// associations when CloudFormation replaces the usage plan resource.
new CfnUsagePlanKey(apiStack, 'MimirUsagePlanKey', {
  keyId: mimirApiKeyId,
  keyType: 'API_KEY',
  usagePlanId: mimirUsagePlan.usagePlanId,
});

// Explicitly scope the Lambda resource policy to this API + account only
cfnMimirActionHandlerFunction.addPermission('ApiGatewayInvokeScoped', {
  principal: new cdk.aws_iam.ServicePrincipal('apigateway.amazonaws.com'),
  action: 'lambda:InvokeFunction',
  sourceArn: restAPI.arnForExecuteApi('POST', '/mimir-action', '*'),
  sourceAccount: cdk.Aws.ACCOUNT_ID,
});

// Add POST method with API key auth (no Cognito — Mimir is an external system)
mimirActionResource.addMethod('POST', mimirActionLambdaIntegration, {
  apiKeyRequired: true,
  methodResponses: [
    {
      statusCode: '200',
      responseParameters: {
        'method.response.header.Access-Control-Allow-Origin': true,
        'method.response.header.Access-Control-Allow-Headers': true,
        'method.response.header.Access-Control-Allow-Methods': true,
      },
    },
  ],
});

// ============================================================
// End MIMIR Integration
// ============================================================

// ============================================================
// Push to Mimir — Send compliance data to Mimir API
// ============================================================

// Mimir API base URL — not a secret, hardcoded as env var
cfnPushToMimirFunction.addEnvironment('MIMIR_API_URL', 'https://us.mjoll.no/api/v1');

// Mimir API token — create manually via ./scripts/setup-mimir.sh before first deploy:
const mimirApiTokenParamName = `/shared/MIMIR_API_TOKEN`;
cfnPushToMimirFunction.addEnvironment('MIMIR_API_TOKEN_PARAM', mimirApiTokenParamName);

// Grant the Lambda permission to read the Mimir token from SSM
cfnPushToMimirFunction.addToRolePolicy(new PolicyStatement({
  effect: Effect.ALLOW,
  actions: ['ssm:GetParameter'],
  resources: [
    `arn:aws:ssm:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:parameter${mimirApiTokenParamName}`,
  ],
}));

// Create Lambda integration for push-to-mimir handler
const pushToMimirLambdaIntegration = new cdk.aws_apigateway.LambdaIntegration(cfnPushToMimirFunction, {
  proxy: true,
});

// Add push-to-mimir API resource
const pushToMimirResource = restAPI.root.addResource('mimir-push');

// Add OPTIONS method for CORS preflight (unauthenticated)
addCorsOptions(pushToMimirResource, { allowMethods: "'POST,OPTIONS'" });

// Add POST method with Cognito auth
addAuthenticatedMethod({
  resource: pushToMimirResource,
  httpMethod: 'POST',
  integration: pushToMimirLambdaIntegration,
  authorizer: cognitoAuthorizer,
  methodOptions: {
    methodResponses: [
      {
        statusCode: '200',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Origin': true,
          'method.response.header.Access-Control-Allow-Headers': true,
          'method.response.header.Access-Control-Allow-Methods': true,
        },
      },
    ],
  },
});

// ============================================================
// End Push to Mimir
// ============================================================

backend.addOutput({
  custom: {
    region: cdk.Aws.REGION,
    apiName: restAPI.restApiName,
    stepFunctionArn: complianceWorkflowStateMachine.stateMachineArn,
    API: {
      [restAPI.restApiName]: {
        endpoint: restAPI.url,
        region: Stack.of(restAPI).region,
        apiName: restAPI.restApiName,
      },
    },
  },
});