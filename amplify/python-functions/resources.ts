import { Stack, Duration, BundlingOptions, ILocalBundling, Size, Names } from 'aws-cdk-lib';
import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';


const functionDir = path.dirname(fileURLToPath(import.meta.url));

class LambdaPythonBundler implements ILocalBundling {
  private functionDir;
  private isCompiledPackage;
  constructor(functionDir: string, isCompiledPackage?: boolean) {
    this.functionDir = functionDir;
    this.isCompiledPackage = isCompiledPackage || false;
  }
  
  public tryBundle(outputDir: string, options: BundlingOptions) {
    try {
      execSync('pip3 --version');
    } catch {
      return false;
    }

    // Only install Python dependencies if a requirements.txt exists
    const requirementsPath = path.join(this.functionDir, 'requirements.txt');
    if (fs.existsSync(requirementsPath)) {
      // compiled package is necessary for packages that are compiled, such as numpy
      // see: https://docs.aws.amazon.com/lambda/latest/dg/python-layers.html and https://repost.aws/knowledge-center/lambda-python-package-compatible
      const pipCmd = !this.isCompiledPackage
        ? `pip3 install -r "${requirementsPath}" -t "${outputDir}"`
        : `pip3 install -r "${requirementsPath}" --platform manylinux2014_x86_64 --only-binary=:all: -t "${outputDir}"`;
      execSync(pipCmd);
    }

    // Copy function source files to output
    fs.cpSync(this.functionDir, outputDir, { recursive: true });

    // Copy shared commoncode module
    const commoncodeOut = path.join(outputDir, 'commoncode');
    fs.mkdirSync(commoncodeOut, { recursive: true });
    fs.copyFileSync(
      path.join(this.functionDir, '..', 'commoncode', '__init__.py'),
      path.join(commoncodeOut, '__init__.py')
    );

    return true;
  }
}

export class CustomLambdaConstruct extends Construct {
  // Generates a unique but readable function name to avoid CloudFormation naming collisions
  // e.g. "generate-playback-assets-dev-5F2A1B3C"
  private uniqueFnName(baseName: string): string {
    const branch = process.env.AWS_BRANCH || 'default';
    const hash = Names.uniqueId(this).slice(-8);
    return `${baseName}-${branch}-${hash}`;
  }

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const ffmpegLayer = new lambda.LayerVersion(this, 'FFmpegLayer', {
      code: lambda.Code.fromAsset('amplify/python-functions/ffmpeg/'),
      compatibleRuntimes: [lambda.Runtime.PYTHON_3_9],
      description: 'FFmpeg binary layer',
    });

    const pillowLayer = lambda.LayerVersion.fromLayerVersionArn(
      this,
      'pillow-layer',
      `arn:aws:lambda:${Stack.of(this).region}:770693421928:layer:Klayers-p312-pillow:2`
    );

    new lambda.Function(this, 'generatePlaybackAssetsFunction', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'index.lambda_handler',
      functionName: this.uniqueFnName('generate-video-playback-assets'),
      description: 'Generates playback assets like thumbnails and hls playlist',
      timeout: Duration.seconds(900),
      memorySize: 256,
      code: lambda.Code.fromAsset(functionDir, {
        bundling: {
          image: lambda.Runtime.PYTHON_3_12.bundlingImage, // this is just a fallback, the build process must support Docker if you decide to use this
          local: new LambdaPythonBundler(`${functionDir}/generateVideoPlaybackAssets`) // functionDir is the root of custom-functions. Must specify lambda folder here
        },
      }),
    });

    new lambda.Function(this, 'generateGeneralComplianceReportFunction', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'index.lambda_handler',
      functionName: this.uniqueFnName('generate-general-compliance-report'),
      description: 'Generates compliance summary using Amazon Nova Video Understanding',
      timeout: Duration.seconds(900),
      memorySize: 256,
      code: lambda.Code.fromAsset(functionDir, {
        bundling: {
          image: lambda.Runtime.PYTHON_3_12.bundlingImage, // this is just a fallback, the build process must support Docker if you decide to use this
          local: new LambdaPythonBundler(`${functionDir}/generateGeneralComplianceReport`) // functionDir is the root of custom-functions. Must specify lambda folder here
        },
      }),
    });

    new lambda.Function(this, 'generateDetailedComplianceReportFunction', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'index.lambda_handler',
      functionName: this.uniqueFnName('generate-detailed-compliance-report'),
      description: 'Generates compliance summary using frame analysis with Amazon Nova Image Understanding',
      timeout: Duration.seconds(900),
      memorySize: 256,
      code: lambda.Code.fromAsset(functionDir, {
        bundling: {
          image: lambda.Runtime.PYTHON_3_12.bundlingImage, // this is just a fallback, the build process must support Docker if you decide to use this
          local: new LambdaPythonBundler(`${functionDir}/generateDetailedComplianceReport`) // functionDir is the root of custom-functions. Must specify lambda folder here
        },
      }),
    });

    new lambda.Function(this, 'generateTranscriptFunction', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'index.lambda_handler',
      functionName: this.uniqueFnName('generate-transcript'),
      description: 'Generates transcript from video using Amazon Transcribe',
      timeout: Duration.seconds(900),
      memorySize: 256,
      code: lambda.Code.fromAsset(functionDir, {
        bundling: {
          image: lambda.Runtime.PYTHON_3_12.bundlingImage,
          local: new LambdaPythonBundler(`${functionDir}/generateTranscript`)
        },
      }),
    });

    new lambda.Function(this, 'startComplianceWorkflowFunction', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'index.lambda_handler',
      functionName: this.uniqueFnName('start-compliance-workflow'),
      description: 'Starts compliance workflow when video is uploaded',
      timeout: Duration.seconds(60),
      memorySize: 128,
      code: lambda.Code.fromAsset(functionDir, {
        bundling: {
          image: lambda.Runtime.PYTHON_3_12.bundlingImage,
          local: new LambdaPythonBundler(`${functionDir}/startComplianceWorkflow`)
        },
      }),
    });

    new lambda.Function(this, 'analyseFrames', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'index.lambda_handler',
      functionName: this.uniqueFnName('analyse-frames'),
      description: 'Analyses the Frames',
      timeout: Duration.seconds(300),
      memorySize: 128,
      code: lambda.Code.fromAsset(functionDir, {
        bundling: {
          image: lambda.Runtime.PYTHON_3_12.bundlingImage,
          local: new LambdaPythonBundler(`${functionDir}/analyseFrames`)
        },
      }),
    });

    new lambda.Function(this, 'stepFunctionFail', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'index.lambda_handler',
      functionName: this.uniqueFnName('step-function-fail'),
      description: 'Handles Step Function failures',
      timeout: Duration.seconds(60),
      memorySize: 128,
      code: lambda.Code.fromAsset(functionDir, {
        bundling: {
          image: lambda.Runtime.PYTHON_3_12.bundlingImage,
          local: new LambdaPythonBundler(`${functionDir}/stepFunctionFail`)
        },
      }),
    });

    new lambda.Function(this, 'selectFramesForAnalysis', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'index.handler',
      functionName: this.uniqueFnName('select-frames-for-analysis'),
      description: 'Selects frames for analysis from video shots',
      timeout: Duration.seconds(900),
      memorySize: 4096,
      layers: [ pillowLayer ],
      code: lambda.Code.fromAsset(functionDir, {
        bundling: {
          image: lambda.Runtime.PYTHON_3_12.bundlingImage,
          local: new LambdaPythonBundler(`${functionDir}/selectFramesForAnalysis`)
        },
      }),
    });

    new lambda.Function(this, 'validateRightsFunction', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'index.lambda_handler',
      functionName: this.uniqueFnName('validate-rights'),
      description: 'Validates asset rights',
      timeout: Duration.seconds(300),
      memorySize: 128,
      code: lambda.Code.fromAsset(functionDir, {
        bundling: {
          image: lambda.Runtime.PYTHON_3_12.bundlingImage,
          local: new LambdaPythonBundler(`${functionDir}/validateRights`)
        },
      }),
    });
    new lambda.Function(this, 'createChunks', {
      runtime: lambda.Runtime.PYTHON_3_9,
      handler: 'index.lambda_handler',
      functionName: this.uniqueFnName('create-chunks'),
      description: 'Creates chunks for processing',
      timeout: Duration.seconds(900),
      memorySize: 256,
      ephemeralStorageSize: Size.gibibytes(5),
      layers: [ffmpegLayer],
      code: lambda.Code.fromAsset(functionDir, {
        bundling: {
          image: lambda.Runtime.PYTHON_3_9.bundlingImage,
          local: new LambdaPythonBundler(`${functionDir}/createChunks`)
        },
      }),
    });

    new lambda.Function(this, 'analyseChunks', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'index.lambda_handler',
      functionName: this.uniqueFnName('analyse-chunks'),
      description: 'Analyses chunks for compliance',
      timeout: Duration.seconds(900),
      memorySize: 128,
      code: lambda.Code.fromAsset(functionDir, {
        bundling: {
          image: lambda.Runtime.PYTHON_3_12.bundlingImage,
          local: new LambdaPythonBundler(`${functionDir}/analyseChunks`)
        },
      }),
    });

    new lambda.Function(this, 'repairJSONFunction', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'index.lambda_handler',
      functionName: this.uniqueFnName('repair-json'),
      description: 'Repairs malformed JSON',
      timeout: Duration.seconds(300),
      memorySize: 128,
      code: lambda.Code.fromAsset(functionDir, {
        bundling: {
          image: lambda.Runtime.PYTHON_3_12.bundlingImage,
          local: new LambdaPythonBundler(`${functionDir}/repairJSON`)
        },
      }),
    });

    new lambda.Function(this, 'validateQCFunction', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'index.lambda_handler',
      functionName: this.uniqueFnName('validate-qc'),
      description: 'Validates language consistency for QC',
      timeout: Duration.seconds(300),
      memorySize: 128,
      code: lambda.Code.fromAsset(functionDir, {
        bundling: {
          image: lambda.Runtime.PYTHON_3_12.bundlingImage,
          local: new LambdaPythonBundler(`${functionDir}/validateQC`)
        },
      }),
    });

    new lambda.Function(this, 'validateIMDBFunction', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'index.lambda_handler',
      functionName: this.uniqueFnName('validate-imdb'),
      description: 'Validates IMDB information for media assets',
      timeout: Duration.seconds(900),
      memorySize: 128,
      code: lambda.Code.fromAsset(functionDir, {
        bundling: {
          image: lambda.Runtime.PYTHON_3_12.bundlingImage,
          local: new LambdaPythonBundler(`${functionDir}/validateIMDB`)
        },
      }),
    });

    new lambda.Function(this, 'runAgentsFunction', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'index.lambda_handler',
      functionName: this.uniqueFnName('run-agents'),
      description: 'Runs validation agents for rights, QC, and IMDB',
      timeout: Duration.seconds(900),
      memorySize: 256,
      code: lambda.Code.fromAsset(functionDir, {
        bundling: {
          image: lambda.Runtime.PYTHON_3_12.bundlingImage,
          local: new LambdaPythonBundler(`${functionDir}/runAgents`)
        },
      }),
    });

    new lambda.Function(this, 'saveWorkflowTimeFunction', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'index.lambda_handler',
      functionName: this.uniqueFnName('save-workflow-time'),
      description: 'Saves workflow time after video and frame analysis complete',
      timeout: Duration.seconds(60),
      memorySize: 128,
      code: lambda.Code.fromAsset(functionDir, {
        bundling: {
          image: lambda.Runtime.PYTHON_3_12.bundlingImage,
          local: new LambdaPythonBundler(`${functionDir}/saveWorkflowTime`)
        },
      }),
    });

    new lambda.Function(this, 'mimirActionHandlerFunction', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'index.lambda_handler',
      functionName: this.uniqueFnName('mimir-action-handler'),
      description: 'Handles custom action requests from MIMIR MAM integration',
      timeout: Duration.seconds(900),
      memorySize: 1024,
      ephemeralStorageSize: Size.gibibytes(5),
      code: lambda.Code.fromAsset(functionDir, {
        bundling: {
          image: lambda.Runtime.PYTHON_3_12.bundlingImage,
          local: new LambdaPythonBundler(`${functionDir}/mimirActionHandler`)
        },
      }),
    });

    new lambda.Function(this, 'pushToMimirFunction', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'index.lambda_handler',
      functionName: this.uniqueFnName('push-to-mimir'),
      description: 'Converts compliance timeline data to Mimir format and pushes to Mimir API',
      timeout: Duration.seconds(180),
      memorySize: 256,
      code: lambda.Code.fromAsset(functionDir, {
        bundling: {
          image: lambda.Runtime.PYTHON_3_12.bundlingImage,
          local: new LambdaPythonBundler(`${functionDir}/pushToMimir`)
        },
      }),
    });
  }
}