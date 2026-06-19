# Guidance for Automated Content Compliance with AI-powered Video Analysis and Agents

Automate content compliance with AI-powered video analysis that transforms hours of manual review into minutes, helping broadcasters and streaming platforms deliver compliant media content faster and more cost-effectively. Leverage Amazon Bedrock to analyze content across multiple rating systems, while maintaining accuracy, and reducing cost.

## Table of Contents

1. [Overview](#overview)
    - [Architecture](#architecture)
    - [Cost](#cost)
2. [Prerequisites](#prerequisites)
3. [Deployment Steps](#deployment-steps)
4. [Deployment Validation](#deployment-validation)
5. [Running the Guidance](#running-the-guidance)
6. [Next Steps](#next-steps)
7. [Cleanup](#cleanup)
8. [FAQ, known issues, additional considerations, and limitations](#faq-known-issues-additional-considerations-and-limitations)
9. [Notices](#notices)
10. [Authors](#authors)

## Overview

#### Overview of Problem

- Reviewing video/image content for compliance issues is challenging and costly
- Media companies are struggling with exploding content volumes, strict compliance requirements, and rising operational costs
- Compliance review times are increasing due to complex, multi-regional requirements
- Human review is error-prone and exhausting

#### Overview of Solution

- Automate the content moderation process with advanced video analysis using both video and image understanding models
- Ensure consistent reviews across your content library, reducing the number of false negatives
- Achieve a content rating, similar to popular media rating taxonomies
- Process long-form video of multi-hour long feature films
- Get detailed analysis results at the video, and frame-level including timestamp-level details of compliance flags
- Catches nuanced content elements that a human reviewer may miss, leaving compliance officers to focus on tasks that require human judgement

#### Why this Solution?

- Simply upload media to the system, and it automatically analyzes every frame against multiple rating systems and compliance standards
- Customize what flags you are looking for in the UI
- Choose your frame analysis rate in the UI (e.g. music videos, sports are dynamic and fast-changing, requiring a faster frame rate)
- Generate comprehensive compliance reports with frame-accurate timestamps
- Cost-optimization techniques such as perceptual hashing to reduce frame analysis cost of similar frames

#### Architecture

##### How it Works

1. **Configure** your analysis settings on the Config page. Choose which Bedrock models to use for video and frame analysis, adjust inference parameters (temperature, topP, maxTokens), set the pHash threshold for frame deduplication, and select house rating categories. These settings are used by the rest of the solution.
  ![Config Page](docs/images/config-page.jpg)

2. **Upload** an MP4 video on the Analyze page and select a content type (Film, Episodic, Trailer, Music Video, News). The content type determines the default frames-per-second rate used for frame extraction, as configured on the Config page.
![Analyze Page](docs/images/analyze-page.jpg)

3. An S3 upload event triggers an **AWS Step Functions workflow** that orchestrates the full pipeline:
   - **MediaConvert** generates HLS playback assets and thumbnail frames.
   - **Amazon Transcribe** generates a transcript (or you can provide one).
   - The video is split into segments and each segment is analyzed by a Bedrock model against your configured compliance categories.
   - **Frame-level analysis** runs concurrently using a Distributed Map, with pHash-based deduplication to skip similar frames.
   - **Bedrock Agents** run optional validations: rights clearance, QC language checks, and IMDb cross-referencing.
   - A **general and detailed compliance report** is generated.

4. **View results** on the Analysis Results page with video playback, segment-level findings, frame annotations, transcript, agent reports, and cost breakdown.  
![Analysis Results - Video](docs/images/analysis-results-video-page.jpg)  
![Analysis Results - Timeline](docs/images/analysis-results-timeline-page.jpg)  
![Analysis Cost](docs/images/analysis-results-cost-page.jpg)  

All processing happens in the background. You can navigate away and find completed results in the History page.

![History Page](docs/images/history-page.jpg)

![Statistics Page](docs/images/statistics-page.jpg)

##### Architecture Diagram
![Architecture](docs/images/architecture.png)

#### Pages

| Page | Description |
|---|---|
| **Analyze** | Upload MP4 videos and kick off the compliance workflow. Select content type and monitor upload progress. |
| **Analysis Results** | View compliance reports, video playback with HLS, frame-level findings, transcript, agent results, and analysis cost. |
| **History** | Browse all previously analyzed videos and their results. |
| **Config** | Configure which Bedrock models to use for video and frame analysis, adjust inference parameters (temperature, topP, maxTokens), set the pHash threshold for frame deduplication, and manage house rating categories. |
| **Statistics** | View cost and usage statistics across all your analyses for the current month. |
| **Architecture** | Overview of the AWS services and architecture powering the solution. |
| **Help** | FAQ, tips, troubleshooting, and known limitations. |


### Cost

This section is for a high-level cost estimate. Think of a likely straightforward scenario with reasonable assumptions based on the problem the Guidance is trying to solve. Provide an in-depth cost breakdown table in this section below ( you should use AWS Pricing Calculator to generate cost breakdown ).

Start this section with the following boilerplate text:

_You are responsible for the cost of the AWS services used while running this Guidance. As of <month> <year>, the cost for running this Guidance with the default settings in the <Default AWS Region (Most likely will be US East (N. Virginia)) > is approximately $<n.nn> per month for processing ( <nnnnn> records )._

Replace this amount with the approximate cost for running your Guidance in the default Region. This estimate should be per month and for processing/serving resonable number of requests/entities.

Suggest you keep this boilerplate text:
_We recommend creating a [Budget](https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-managing-costs.html) through [AWS Cost Explorer](https://aws.amazon.com/aws-cost-management/aws-cost-explorer/) to help manage costs. Prices are subject to change. For full details, refer to the pricing webpage for each AWS service used in this Guidance._

### Sample Cost Table

**Note : Once you have created a sample cost table using AWS Pricing Calculator, copy the cost breakdown to below table and upload a PDF of the cost estimation on BuilderSpace. Do not add the link to the pricing calculator in the ReadMe.**

The following table provides a sample cost breakdown for deploying this Guidance with the default parameters in the US East (N. Virginia) Region for one month.

| AWS service  | Dimensions | Cost [USD] |
| ----------- | ------------ | ------------ |
| Amazon API Gateway | 1,000,000 REST API calls per month  | $ 3.50month |
| Amazon Cognito | 1,000 active users per month without advanced security feature | $ 0.00 |

## Prerequisites
> ⚠️ **IMPORTANT: Ensure the prerequisites are complete before moving onto the deployment steps.**

### Operating System
You will need an environment to run the deployment steps from. This will be your temporary working space. 

- Local development/deployment has been tested on Mac and Windows
- To develop/deploy from an AWS environment, you may use an Amazon Linux 2023 kernel-6.1+ AMI to run the deployment steps. 
  - Create an EC2 instance with the AMI above
  - Ensure the EC2 instance type is at least a t3.medium
  - Ensure the EC2 instance has an IAM role with sufficient permissions to deploy the CDK stacks
  - Add a security group inbound rule allowing SSH from the EC2 Instance Connect prefix list
  ![EC2 Instance Connect SSH Configuration](docs/images/ec2-instance-connect-security-group.png)
  - Then, connect to the instance following [these steps](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-instance-connect-methods.html#ec2-instance-connect-connecting-console).


### Dependencies

- **Git** — required to download the source code
  - On Amazon Linux 2023, install using:
  ```bash
  sudo dnf install -y git
  ```
- **Node.js (v18.17+) and npm** — required for the frontend, CDK synthesis, and cross-platform Python Lambda bundling
  - On Amazon Linux 2023, install using:
  ```bash
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

  # reload your shell so nvm is on PATH
  source ~/.bashrc

  nvm install 18
  ```

- **Python and Pip** — required for bundling Lambda function dependencies during deployment
  - Ensure at least Python 3.12 is available
  - Install using:
  ```bash
  # Install Python 3.12 (separate package; leaves system python3=3.9 intact)
  
  sudo dnf install -y python3.12 python3.12-pip
  ```

- **AWS CLI** — configured with credentials 
  - On Amazon Linux 2023, the AWS CLI is already available and configured if you specified an IAM role when creating the EC2 instance
- **AWS Amplify CLI** — required to deploy the infrastructure
  - Install using:
  ```bash
  npm install -g @aws-amplify/backend-cli
  ```
- **AWS CDK CLI (v2)** — required to deploy the infrastructure
  - Install using:
  ```bash
  npm install -g aws-cdk
  ```

### Third-party tools

*Fonn Group's Mimir is optional in the architecture.*


### AWS account requirements

- **Amazon Bedrock foundation models** — ensure models selected are accessible
- **AWS CDK Bootstrap** — CDK must be bootstrapped once in each operating region if it doesn't already exist. For detailed explanation, see [AWS CDK bootstrapping guide](https://docs.aws.amazon.com/cdk/v2/guide/bootstrapping.html)
  - Configure using:
  ```bash
  # Important: substitute account id and region with real values

  cdk bootstrap aws://<account-id>/<region>
  ```

### Service limits

- **Amazon Bedrock Model Throughput** — raise model limits depending on your current quotas, especially for long-form content
- **SSM Parameter Store High Throughput** — must be enabled to avoid `ThrottlingException` errors for long-form content. Run the following if applicable:
  ```bash
  aws ssm update-service-setting \
    --setting-id /ssm/parameter-store/high-throughput-enabled \
    --setting-value true
  ```

### Supported Regions

The solution has been tested with the **us-west-2** region extensively.

Check if your region is set:
```bash
# Should return non-empty region

aws configure get region
```

If this command returned empty, you need to set your region

```bash
# Important: substitute the region (e.g. us-west-2)
aws configure set region <region>
```


## Deployment Steps

#### 1. Clone and install dependencies

```bash
git clone https://github.com/aws-solutions-library-samples/guidance-for-automated-content-compliance-with-ai-powered-video-analysis-and-agents-on-aws.git

cd guidance-for-automated-content-compliance-with-ai-powered-video-analysis-and-agents-on-aws

# Note: this command takes some time
npm ci
```

#### 2. Set your environment branch

Create or update `.env.local` at the project root:

```bash
# Important: substitute the branch name

echo "AWS_BRANCH=<your-unique-name>" >> .env.local
```

This value namespaces your SSM parameters and resources so multiple developers can deploy to the same account without conflicts.

#### 3. Configure Mimir secrets

The deployment requires Mimir SSM parameters to exist, even if you don't use Mimir. Run the setup script once per AWS account before the first deploy:

```bash
# Note: if this returns no output, ensure the script is executable first (chmod +x ./scripts/setup-mimir.sh)

./scripts/setup-mimir.sh
```

It prompts for two values (either can be skipped by pressing Enter). Do NOT leave the values blank, otherwise deploying the sandbox will fail.

- **Custom Action Key** — the `x-api-key` value Mimir sends to your `/mimir-action` endpoint. The script creates a shared API Gateway key and stores its ID in SSM for CDK to import. Requires redeploy if you need to update it later.
- **API Token** — the bearer token used when pushing compliance data back to the Mimir API. Read at runtime; takes effect immediately.

All Mimir parameters are stored under `/shared/` in SSM, so they're shared across all branches in the account.

#### 4. Customize the rating system (recommended)

The default analysis prompt uses generic made-up rating categories that don't exist. For better accuracy, replace them with a well-known industry rating system and define what each level means. See [Customizing the Rating System](#customizing-the-rating-system) for details and examples. To deploy the default, continue with the following step.

#### 5. Deploy the backend (cloud sandbox via Amplify)

```bash
# Create and activate an isolated venv 
# Ensures correct python/pip version
  
python3.12 -m venv ~/deployenv
source ~/deployenv/bin/activate

npm run sandbox
```

This uses `ampx sandbox` to deploy all backend resources into your AWS account. The first deploy takes about 7 minutes.

#### 6. Run or deploy the frontend

You can run the frontend locally for development, or deploy it to the S3 + CloudFront hosting. Either way it talks to the same backend.

**Option A — Run locally**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. Sign up for an account through the Cognito auth flow.

**Option B — Deploy to S3 + CloudFront (hosted URL)**

The backend deploy step creates a private S3 bucket and a CloudFront distribution for the frontend. Build and publish the app with:

```bash
./scripts/deploy-frontend.sh
```

This builds a static export of the app, uploads it to the hosting bucket, and invalidates the CloudFront cache. When it finishes it prints the CloudFront URL — open that in your browser and sign up through the Cognito auth flow. The same URL is available in `amplify_outputs.json` under `custom.frontendUrl`.

> The CloudFront URL serves the static app (HTML/JS) publicly. Access to your data is still protected by Amazon Cognito at the API and data layer. Re-run the script whenever you want to publish new frontend changes.


## Deployment Validation

**Backend**

- After running `npm run sandbox`, you should see the stack output values, and the following text:
  - `[Sandbox] Watching for file changes... File written: amplify_outputs.json`

**OPTIONAL: Frontend (local)**

- Run `npm run dev` and open [http://localhost:3000](http://localhost:3000). You should reach the Cognito sign-up/sign-in screen, and after signing in, the Content Compliance Dashboard.

**Frontend (S3 + CloudFront)**

- Frontend deployed to: https://<distribution>.cloudfront.net`.
- Open that URL in your browser. It should redirect to HTTPS and load the same dashboard (allow a few minutes after the first deploy for the distribution and cache invalidation to propagate).


## Running the Guidance

<Provide instructions to run the Guidance with the sample data or input provided, and interpret the output received.> 

This section should include:

* Guidance inputs
* Commands to run
* Expected output (provide screenshot if possible)
* Output description

## Next Steps 

#### Video Segmentation

Videos are split into fixed-length segments (default: 15 minutes) before analysis. Each segment is independently analyzed by the configured Bedrock model alongside its own transcript. The segment duration is configurable via `CHUNK_LENGTH` in `amplify/python-functions/createChunks/index.py` before deployment.

The current fixed-duration approach is intended for prototyping. For production use with long-form content, consider segmenting at scene, shot, or chapter level for more meaningful analysis boundaries.

#### Customizing the Rating System

The default analysis prompt uses generic rating categories ("Adult 18+", "Teen 13+", "Child 7+", "All Ages") that don't correspond to any real-world rating system. For more accurate and consistent results, replace these with well-known industry rating guidelines and provide explicit definitions for each level.

The rating prompt is defined in `amplify/python-functions/analyseChunks/index.py` under the `##JSON_GUIDELINES##` section. The relevant lines are:

```
- ##Suggested Rating##: "Adult 18+", "Teen 13+", "Child 7+", or "All Ages"
```

Replace these with a recognized system and add descriptions so the model understands what each level means.

The more specific your rating definitions are, the more consistently the model will classify content. This is especially important for borderline content where the distinction between adjacent ratings matters.

#### Updating Bedrock Models

Amazon Bedrock regularly releases new foundation models and retires older ones. The models that appear in the Config page are defined in `amplify/global-variables.ts`. When a new model is released (or an existing one is deprecated), update this file and redeploy so the app keeps offering current models.

There are three places to edit, and they must stay in sync:

1. The `BedrockModelIds` enum (in `amplify/global-variables.ts`) — holds the inference profile / model id.
2. The `vars.BEDROCK_MODELS` array (in `amplify/global-variables.ts`) — holds the descriptive entry (name, provider, modality, use cases, token ranges, and the pricing the UI uses for cost estimates).
3. The `model_pricing` map in `calculate_model_cost()` (in `amplify/python-functions/commoncode/__init__.py`) — the pricing the Lambda functions use to compute and record the actual cost statistics for each analysis, keyed by the same model id.

**Add a new model**

```typescript
// 1) Add the id to the BedrockModelIds enum
export enum BedrockModelIds {
  // ...existing ids...
  CLAUDE_x_SONNET = 'global.anthropic.claude-sonnet-x-abcd-v1:0',
}

// 2) Add a matching entry to vars.BEDROCK_MODELS
{
  id: BedrockModelIds.CLAUDE_x_SONNET,
  name: 'Claude x Sonnet',
  provider: 'Anthropic',
  category: BedrockModality.MULTIMODAL,
  modalities: [BedrockModality.TEXT, BedrockModality.IMAGE, BedrockModality.VIDEO],
  useCase: [BedrockUseCase.VIDEO_UNDERSTANDING, BedrockUseCase.IMAGE_UNDERSTANDING, BedrockUseCase.CHAT],
  pricing: {
    inputTokens: 0.003,   // per 1K tokens — set to the model's actual pricing
    outputTokens: 0.015,  // per 1K tokens
  },
  isDeprecated: false,
},
```

```python
# 3) Add a matching pricing entry to the model_pricing map in
#    calculate_model_cost() in amplify/python-functions/commoncode/__init__.py
'global.anthropic.claude-sonnet-x-abcd-v1:0': {
    'provider': 'Anthropic', 'model': 'Claude x Sonnet',
    'input': 0.003,   # per 1K tokens (for video-priced models, store the per-second-of-video rate here)
    'output': 0.015,  # per 1K tokens
},
```

**Deprecate an old model**

Prefer marking a model `isDeprecated: true` over deleting its entry, so historical analyses that referenced it still render correctly (e.g. `Claude 3.5 Sonnet v2` and `Claude 3.7 Sonnet` are already flagged this way). Deprecated models are kept out of new analyses but remain resolvable for past results:

```typescript
{
  id: BedrockModelIds.CLAUDE_4_5_SONNET,
  name: 'Claude 4.5 Sonnet',
  // ...
  isDeprecated: true,  // hidden from new analyses, retained for past results
},
```

After editing, redeploy the backend with `npm run sandbox`, and if you use the hosted frontend, re-run `./scripts/deploy-frontend.sh`. Make sure model access is enabled for any newly added models in the Bedrock console, and verify the pricing values in both files against the [Bedrock pricing page](https://aws.amazon.com/bedrock/pricing/) so the cost estimates and recorded statistics stay accurate.



#### OPTIONAL: Configure CI/CD

For CI/CD deployment via AWS Amplify Hosting, connect your repository in the [Amplify console](https://console.aws.amazon.com/amplify/). The included `amplify.yml` handles the build pipeline. See the [Amplify deployment docs](https://docs.amplify.aws/nextjs/start/quickstart/nextjs-app-router-client-components/#deploy-a-fullstack-app-to-aws) for details.

#### OPTIONAL: Media Asset Management Integration

MIMIR is a MAM (Media Asset Management) system that supports "custom actions" — configurable menu items that appear on assets in the MIMIR UI. When a user right-clicks an asset and selects a custom action, MIMIR invokes an API endpoint in your AWS account with details about the selected asset(s) to run the compliance workflow and report results back into the MAM.

![MIMIR Compliance Integration](docs/images/mimir-compliance-integration.jpg)

> **Note:** The current Mimir integration is a proof of concept developed with very restricted access to the Mimir tool. The code can be optimized further if you have full control over Mimir environment and permissions.

This solution includes two MIMIR integration points:

- **Inbound** (`/mimir-action`): MIMIR triggers the compliance workflow by downloading a video asset via the Mimir API and uploading it to the app's S3 bucket. Requests are validated using an API Gateway API key passed via the x-api-key header.
- **Outbound** (Push to Mimir): After analysis, compliance timeline data can be pushed back to MIMIR as timed metadata from the Timeline Report tab.

##### MIMIR Custom Action Setup

The Mimir custom action endpoint is at `{api-endpoint}/mimir-action`. After deploying, find the API endpoint in `amplify_outputs.json` under `custom.API`.

In the Mimir admin console, configure the custom action with:

| Field | Value |
|---|---|
| Custom Action URL | `{api-endpoint}/mimir-action?compliance-user-id={your-cognito-identity-id}` |
| Custom Header Field | `x-api-key` |
| Custom Header Value | The same key value you set in `./scripts/setup-mimir.sh` |

The `compliance-user-id` query parameter is the Cognito Identity ID of the app user whose history should show the analysis results. Videos are scoped per user in the UI, so this ensures Mimir-triggered analyses appear in the correct user's history.

Before deploying, run the setup script once per AWS account to configure both Mimir secrets:

```bash
./scripts/setup-mimir.sh
```

See the [MIMIR Action Handler README](amplify/python-functions/mimirActionHandler/README.md) for API details, request/response formats, and setup instructions.

## Cleanup

- Tear down the cloud sandbox with Amplify. See this [reference](https://docs.amplify.aws/react/deploy-and-host/sandbox-environments/features/#delete-a-sandbox) for delete options.
- Verify that any uploaded content has been deleted from the S3 assets bucket.

- **Frontend hosting (S3 + CloudFront)** — if you deployed the hosted frontend with `./scripts/deploy-frontend.sh` (Option B), the hosting bucket and the CloudFront distribution are part of the sandbox stack (created in `amplify/frontend-hosting/resources.ts` with `autoDeleteObjects` and a `DESTROY` removal policy). Deleting the sandbox above removes the distribution and the bucket, along with the static files the script uploaded. Confirm the teardown completed:
  - The distribution id and bucket name are in `amplify_outputs.json` under `custom.frontendDistributionId` and `custom.frontendBucketName`.
  - Check that the distribution is gone from the [CloudFront console](https://console.aws.amazon.com/cloudfront/v4/home#/distributions) and the bucket is gone from the [S3 console](https://s3.console.aws.amazon.com/s3/buckets/). If either remains, remove it manually.

- **EC2 deployment environment** — if you deployed from an AWS environment (the Amazon Linux 2023 EC2 instance described in the [Prerequisites](#operating-system)) instead of running locally, terminate that instance when you are finished so it stops incurring charges. Terminate it from the [EC2 console](https://console.aws.amazon.com/ec2/home#Instances:) (select the instance → Instance state → Terminate instance).


## FAQ, known issues, additional considerations, and limitations 

**FAQ**

Refer to the list of FAQs in the "Help" section of the application.

**Known issues**

As models become deprecated, they may fail to be used in the app. Replace with newer versions to process media.

**Additional considerations**

*This solution is an accelerator / quick start.*

It is designed to help you quickly upload your videos and see compliance analysis results. There are many nuances and edge cases in content compliance that can be improved upon for production use. For example: segmentation at scene or shot level instead of fixed duration, better merging of segment-level results, and more robust error handling. Use this as a starting point and adapt it to your specific requirements.

Suggestions: 
- For more accurate suggested ratings (e.g. "Teen 13+"), define examples of what each rating level means in the analysis prompt. The default rating system uses generic categories — consider replacing them with well-known industry guidelines for better results.
- Configure analysis models and parameters in the Config page. 
- Select house rating categories to be used for content analysis. You can add custom categories beyond the default ones provided.
- Experiment with the inference parameters on the Config page.
- The Phash Threshold controls sensitivity for detecting duplicate or similar frames. This helps reduce analysis cost and time by avoiding analysis of frames that are too similar.


## Notices

*Customers are responsible for making their own independent assessment of the information in this Guidance. This Guidance: (a) is for informational purposes only, (b) represents AWS current product offerings and practices, which are subject to change without notice, and (c) does not create any commitments or assurances from AWS and its affiliates, suppliers or licensors. AWS products or services are provided “as is” without warranties, representations, or conditions of any kind, whether express or implied. AWS responsibilities and liabilities to its customers are controlled by AWS agreements, and this Guidance is not part of, nor does it modify, any agreement between AWS and its customers.*

> ⚠️ **Disclaimer:** This is an accelerator intended for experimentation and to demonstrate the art of the possible. Use it as a starting point and adapt it to your requirements. Please conduct thorough due diligence, security reviews, and testing before deploying in production environments.


## Authors

Alen Zograbyan  
Vince Palazzo  
Chris Gillespie  