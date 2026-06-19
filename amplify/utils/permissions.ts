import { PolicyStatement, Policy } from 'aws-cdk-lib/aws-iam';
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as stepfunctions from 'aws-cdk-lib/aws-stepfunctions';
import { Construct } from 'constructs';

export interface PolicyResources {
  /** DynamoDB table names (CDK tokens are fine — no cycle through DynamoDB) */
  tableNames: string[];
}

export function createPolicies(resources: PolicyResources) {
  const tableResources = resources.tableNames.flatMap(name => {
    const tableArn = `arn:aws:dynamodb:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:table/${name}`;
    return [tableArn, `${tableArn}/index/*`];
  });

  return {
    bedrock: new PolicyStatement({
      actions: ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
      resources: ["*"]
    }),
    
    bedrockAgent: new PolicyStatement({
      actions: ["bedrock:InvokeAgent"],
      resources: [`arn:aws:bedrock:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:agent-alias/*/*`]
    }),
    
    // S3 uses a static wildcard pattern to avoid circular CloudFormation
    // dependencies (Lambda role -> S3 bucket -> event notification -> Lambda).
    // Amplify names the bucket: amplify-{appId}-mediaanalysiscontentcomp-{hash}
    s3: new PolicyStatement({
      actions: ["s3:Get*", "s3:List*", "s3:Put*"],
      resources: [
        "arn:aws:s3:::*mediaanalysiscontentcomp*",
        "arn:aws:s3:::*mediaanalysiscontentcomp*/*"
      ]
    }),
    
    s3ObjectTagging: new PolicyStatement({
      actions: ["s3:PutObjectTagging", "s3:PutObjectVersionTagging", "s3:DeleteObjectTagging", "s3:DeleteObjectVersionTagging", "s3:GetObjectTagging", "s3:GetObjectVersionTagging"],
      resources: ["arn:aws:s3:::*mediaanalysiscontentcomp*/*"]
    }),
    
    dynamodb: new PolicyStatement({
      actions: ["dynamodb:PutItem", "dynamodb:BatchWriteItem", "dynamodb:UpdateItem", "dynamodb:Query", "dynamodb:GetItem"],
      resources: tableResources
    }),
    
    ssm: new PolicyStatement({
      actions: ["ssm:GetParametersByPath", "ssm:GetParameter"],
      resources: ["*"]
    }),
    
    transcribe: new PolicyStatement({
      actions: ["transcribe:StartTranscriptionJob", "transcribe:GetTranscriptionJob", "s3:GetObject", "s3:PutObject"],
      resources: ["*"]
    }),
    
    // Step Functions uses * because scoping to the state machine ARN creates
    // a circular dependency: Lambdas <-> Step Function <-> S3 bucket.
    stepFunctions: new PolicyStatement({
      actions: ['states:StartExecution', 'states:DescribeExecution', 'states:RedriveExecution'],
      resources: ['*']
    }),
    
    mediaConvert: new PolicyStatement({
      actions: ["mediaconvert:CreateJob", "mediaconvert:GetJob", "mediaconvert:DescribeEndpoints", "iam:PassRole"],
      resources: ["*"]
    })
  };
}

export function applyLambdaPolicies(functions: lambda.Function[], policies: ReturnType<typeof createPolicies>) {
  const lambdaPolicies = [
    policies.bedrock,
    policies.bedrockAgent,
    policies.s3,
    policies.s3ObjectTagging,
    policies.dynamodb,
    policies.ssm,
    policies.transcribe,
    policies.mediaConvert
  ];

  functions.forEach(fn => {
    lambdaPolicies.forEach(policy => fn.addToRolePolicy(policy));
  });
}

export function applyStepFunctionPolicies(stateMachine: stepfunctions.StateMachine, policies: ReturnType<typeof createPolicies>) {
  // S3 permissions for the state machine are auto-granted by CDK via the
  // DistributedMap S3JsonItemReader. Adding them manually here would create
  // a circular dependency.
  stateMachine.addToRolePolicy(policies.stepFunctions);
}

/**
 * Creates the S3 object tagging policy for the Cognito authenticated user role.
 * Uses the same static wildcard pattern as other S3 policies to avoid passing
 * CDK bucket references across stacks.
 */
export function createS3ObjectTaggingPolicy(scope: Construct) {
  return new Policy(scope, "s3ObjectTaggingPolicy", {
    statements: [
      new PolicyStatement({
        actions: ["s3:PutObjectTagging", "s3:PutObjectVersionTagging", "s3:DeleteObjectTagging", "s3:DeleteObjectVersionTagging", "s3:GetObjectTagging", "s3:GetObjectVersionTagging"],
        resources: ["arn:aws:s3:::*mediaanalysiscontentcomp*/*"]
      })
    ]
  });
}
