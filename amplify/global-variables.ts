/**
 * All pricing values in this file are based on On-Demand pricing for the us-west-2 region.
 * If deploying to a different region or using a different pricing model (e.g., Provisioned Throughput),
 * update the pricing values accordingly.
 * See: https://aws.amazon.com/bedrock/pricing/
 */
const appPrefix = 'media-analysis-content-compliance';

export interface BedrockModel {
  id: string;
  name: string;
  provider: string;
  category: BedrockModality.TEXT | BedrockModality.IMAGE | BedrockModality.VIDEO | BedrockModality.MULTIMODAL;
  useCase: BedrockUseCase[];
  modalities: string[];
  ranges?: {
    outputTokens: { min: number, max: number }
  },
  pricing: {
    perSecondOfVideo?: number,  // per second of video
    inputTokens: number,  // per 1K tokens}
    outputTokens: number  // per 1K tokens]
  },
  isDeprecated: boolean
  }
      
export enum BedrockUseCase {
  IMAGE_UNDERSTANDING = 'Image Understanding',
  VIDEO_UNDERSTANDING = 'Video Understanding',
  CHAT = 'Chat'
}

export enum BedrockModality {
  TEXT = 'Text',
  IMAGE = 'Image',
  VIDEO = 'Video',
  MULTIMODAL = 'Multimodal',
}

export enum BedrockAssetType {
  DOCUMENT = 'Document',
  IMAGE = 'Image',
  VIDEO = 'Video',
}

export enum JobStatusValues {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum ProcessingType {
  VIDEO = "Video",
  FRAME = "Frame",
  TRANSCRIPT = "Transcript",
  AGENT = "Agent",
  PROFANITY = "Profanity"
}

export enum BedrockAPIType {
  INVOKE = 'invoke',
  CONVERSE = 'converse'
}

export enum AmazonNovaAcceptedVideoFormat {
  MKV = 'mkv',
  MOV = 'mov',
  MP4 = 'mp4',
  WEBM = 'webm',
  THREE_GP = 'three_gp', // TODO: needs special handling, convert from 3gp to three_gp
  FLV = 'flv',
  MPEG = 'mpeg',
  MPG = 'mpg',
  WMV = 'wmv'
}

export enum AmazonNovaAcceptedTranscriptFormat {
  CSV = 'csv',
  XLS = 'xls',
  XLSX = 'xlsx',
  HTML = 'html',
  TXT = 'txt',
  MD = 'md',
  DOC = 'doc',
}

export const CONTENT_TYPES = {
  MUSIC_VIDEO: "Music Video",
  TRAILER: "Trailer",
  FILM: "Film",
  EPISODIC: "Episodic",
  NEWS: "News"
};

export enum BedrockModelIds {
  AMAZON_NOVA_LITE = 'us.amazon.nova-lite-v1:0',
  AMAZON_NOVA_2_LITE = 'global.amazon.nova-2-lite-v1:0',
  AMAZON_NOVA_PRO = 'us.amazon.nova-pro-v1:0',
  AMAZON_NOVA_2_PRO_PREVIEW = 'us.amazon.nova-2-pro-preview-20251202-v1:0',
  AMAZON_NOVA_PREMIER = 'us.amazon.nova-premier-v1:0',
  CLAUDE_3_5_SONNET_V2 = 'us.anthropic.claude-3-5-sonnet-20241022-v2:0',
  CLAUDE_3_7_SONNET = 'us.anthropic.claude-3-7-sonnet-20250219-v1:0',
  CLAUDE_4_SONNET = 'global.anthropic.claude-sonnet-4-20250514-v1:0',
  CLAUDE_4_5_SONNET = 'global.anthropic.claude-sonnet-4-5-20250929-v1:0',
  CLAUDE_4_6_SONNET = 'global.anthropic.claude-sonnet-4-6',
  CLAUDE_4_6_OPUS = 'global.anthropic.claude-opus-4-6-v1',
  CLAUDE_4_7_OPUS = 'global.anthropic.claude-opus-4-7',
  CLAUDE_4_8_OPUS = 'global.anthropic.claude-opus-4-8',
  MISTRAL_PIXTRAL_LARGE = 'mistral.pixtral-large-2502-v1:0',
  META_LLAMA3_2_11B_INSTRUCT = 'meta.llama3-2-11b-instruct-v1:0',
  META_LLAMA3_2_90B_INSTRUCT = 'meta.llama3-2-90b-instruct-v1:0',
  META_LLAMA4_MAVERICK_17B_INSTRUCT = 'meta.llama4-maverick-17b-instruct-v1:0',
  META_LLAMA4_SCOUT_17B_INSTRUCT = 'meta.llama4-scout-17b-instruct-v1:0',
  TWELVE_LABS_PEGASUS_1_2 = 'us.twelvelabs.pegasus-1-2-v1:0'
}

export const vars = {
    APP_PREFIX: appPrefix,
    ASSET_S3_BUCKET_NAME: appPrefix + '-assets',
    FRONTEND_S3_BUCKET_NAME: appPrefix + '-frontend',
    API_PATHS: {
        ASSETS: 'assets',
        VIDEO_ASSETS: 'assets/video',
        TRANSCRIPT_ASSETS: 'assets/transcript',
        VIDEO_ANALYSIS: 'video-analysis',
        VIDEO_ANALYSIS_NOVA: 'video-analysis/nova',
        VIDEO_ANALYSIS_CLAUDE_HAIKU: 'video-analysis/claude-haiku',
        VIDEO_ANALYSIS_CLAUDE_SONNET: 'video-analysis/claude-sonnet',
        GENERATE_VIDEO_ANALYSIS_NOVA: 'generate-video-analysis/nova',
        GENERATE_VIDEO_ANALYSIS_CLAUDE_HAIKU: 'generate-video-analysis/claude-haiku',
        GENERATE_VIDEO_ANALYSIS_CLAUDE_SONNET: 'generate-video-analysis/claude-sonnet',
    },
    // make sure keys are all lowercase
    S3_CUSTOM_METADATA: {
        //originalfilename: 'x-amz-meta-originalfilename'
        originalfilename: 'originalfilename'
    },
    PAGE_ROUTES: {
        HOME: {
          DISPLAY_NAME: 'Home',
          ROUTE: '/'
        },
        DASHBOARD: {
          DISPLAY_NAME: 'Dashboard',
          ROUTE: '/dashboard'
        },
        ASSET_INGEST: {
          DISPLAY_NAME: 'Asset Ingest',
          ROUTE: '/asset-ingest'
        },
        MEDIA_LIBRARY: {
          DISPLAY_NAME: 'Media Library',
          ROUTE: '/media-library'
        },
        MEDIA_LIBRARY_VIDEO_CHAT: {
          DISPLAY_NAME: 'Video Chat',
          ROUTE: '/media-library/video-chat'
        },
        MEDIA_LIBRARY_ANALYSIS_RESULT: {
          DISPLAY_NAME: 'Analysis Result',
          ROUTE: '/media-library/analysis-result'
        },
        JOB_STATUS: {
          DISPLAY_NAME: 'Job Status',
          ROUTE: '/job-status'
        },
        PENDING_APPROVALS: {
          DISPLAY_NAME: 'Pending Approvals',
          ROUTE: '/pending-approvals'
        },
        CONFIGURATION: {
          DISPLAY_NAME: 'Configuration',
          ROUTE: '/configuration'
        },
        ANALYSIS_HISTORY: {
          DISPLAY_NAME: 'Analysis History',
          ROUTE: '/analysis-history'
        },
    },
    BEDROCK_MODELS: <BedrockModel[]>[
      // Amazon Models
      {
        id: BedrockModelIds.AMAZON_NOVA_LITE,
        name: 'Amazon Nova Lite',
        provider: 'Amazon',
        category: BedrockModality.MULTIMODAL,
        modalities: [BedrockModality.TEXT, BedrockModality.IMAGE, BedrockModality.VIDEO],
        useCase: [BedrockUseCase.VIDEO_UNDERSTANDING, BedrockUseCase.IMAGE_UNDERSTANDING, BedrockUseCase.CHAT],
        ranges: {
          outputTokens: {
            min: 1,
            max: 10000
          }
        },
        pricing: {
          inputTokens: 0.00006,  // per 1K tokens
          outputTokens: 0.00024  // per 1K tokens
        },
        isDeprecated: false
      },
      {
        id: BedrockModelIds.AMAZON_NOVA_2_LITE,
        name: 'Amazon Nova 2 Lite',
        provider: 'Amazon',
        category: BedrockModality.MULTIMODAL,
        modalities: [BedrockModality.TEXT, BedrockModality.IMAGE, BedrockModality.VIDEO],
        useCase: [BedrockUseCase.VIDEO_UNDERSTANDING, BedrockUseCase.IMAGE_UNDERSTANDING, BedrockUseCase.CHAT],
        ranges: {
          outputTokens: {
            min: 1,
            max: 10000
          }
        },
        pricing: {
          inputTokens: 0.0003,  // per 1K tokens
          outputTokens: 0.0025  // per 1K tokens
        },
        isDeprecated: false
      },
      {
        id: BedrockModelIds.AMAZON_NOVA_PRO,
        name: 'Amazon Nova Pro',
        provider: 'Amazon',
        category: BedrockModality.MULTIMODAL,
        modalities: [BedrockModality.TEXT, BedrockModality.IMAGE, BedrockModality.VIDEO],
        useCase: [BedrockUseCase.VIDEO_UNDERSTANDING, BedrockUseCase.IMAGE_UNDERSTANDING, BedrockUseCase.CHAT],
        ranges: {
          outputTokens: {
            min: 1,
            max: 10000
          }
        },
        pricing: {
          inputTokens: 0.0008,  // per 1K tokens
          outputTokens: 0.0032  // per 1K tokens
        },
        isDeprecated: false
      },
      {
        id: BedrockModelIds.AMAZON_NOVA_2_PRO_PREVIEW,
        name: 'Amazon Nova 2 Pro Preview',
        provider: 'Amazon',
        category: BedrockModality.MULTIMODAL,
        modalities: [BedrockModality.TEXT, BedrockModality.IMAGE, BedrockModality.VIDEO],
        useCase: [BedrockUseCase.VIDEO_UNDERSTANDING, BedrockUseCase.IMAGE_UNDERSTANDING, BedrockUseCase.CHAT],
        ranges: {
          outputTokens: {
            min: 1,
            max: 10000
          }
        },
        pricing: {
          inputTokens: 0.00125,  // per 1K tokens
          outputTokens: 0.01  // per 1K tokens
        },
        isDeprecated: false
      },
      {
        id: BedrockModelIds.AMAZON_NOVA_PREMIER,
        name: 'Amazon Nova Premier',
        provider: 'Amazon',
        category: BedrockModality.MULTIMODAL,
        modalities: [BedrockModality.TEXT, BedrockModality.IMAGE, BedrockModality.VIDEO],
        useCase: [BedrockUseCase.VIDEO_UNDERSTANDING, BedrockUseCase.IMAGE_UNDERSTANDING, BedrockUseCase.CHAT],
        ranges: {
          outputTokens: {
            min: 1,
            max: 10000
          }
        },
        pricing: {
          inputTokens: 0.0025,  // per 1K tokens
          outputTokens: 0.0125  // per 1K tokens
        },
        isDeprecated: false
      },
      // Anthropic Models
      {
        id: BedrockModelIds.CLAUDE_3_5_SONNET_V2,
        name: 'Claude 3.5 Sonnet v2',
        provider: 'Anthropic',
        category: BedrockModality.MULTIMODAL,
        modalities: [BedrockModality.TEXT, BedrockModality.IMAGE],
        useCase: [BedrockUseCase.IMAGE_UNDERSTANDING, BedrockUseCase.CHAT],
        pricing: {
          inputTokens: 0.003,  // per 1K tokens}
          outputTokens: 0.015  // per 1K tokens]
        },
        isDeprecated: true
      },
      {
        id: BedrockModelIds.CLAUDE_3_7_SONNET,
        name: 'Claude 3.7 Sonnet',
        provider: 'Anthropic',
        category: BedrockModality.MULTIMODAL,
        modalities: [BedrockModality.TEXT, BedrockModality.IMAGE],
        useCase: [BedrockUseCase.IMAGE_UNDERSTANDING, BedrockUseCase.CHAT],
        pricing: {
          inputTokens: 0.003,  // per 1K tokens
          outputTokens: 0.015  // per 1K tokens
        },
        isDeprecated: true
      },
      {
        id: BedrockModelIds.CLAUDE_4_SONNET,
        name: 'Claude 4 Sonnet',
        provider: 'Anthropic',
        category: BedrockModality.MULTIMODAL,
        modalities: [BedrockModality.TEXT, BedrockModality.IMAGE, BedrockModality.VIDEO],
        useCase: [BedrockUseCase.VIDEO_UNDERSTANDING, BedrockUseCase.IMAGE_UNDERSTANDING, BedrockUseCase.CHAT],
        pricing: {
          inputTokens: 0.003,  // per 1K tokens
          outputTokens: 0.015  // per 1K tokens
        },
        isDeprecated: false
      },
      {
        id: BedrockModelIds.CLAUDE_4_5_SONNET,
        name: 'Claude 4.5 Sonnet',
        provider: 'Anthropic',
        category: BedrockModality.MULTIMODAL,
        modalities: [BedrockModality.TEXT, BedrockModality.IMAGE, BedrockModality.VIDEO],
        useCase: [BedrockUseCase.VIDEO_UNDERSTANDING, BedrockUseCase.IMAGE_UNDERSTANDING, BedrockUseCase.CHAT],
        pricing: {
          inputTokens: 0.003,  // per 1K tokens
          outputTokens: 0.015  // per 1K tokens
        },
        isDeprecated: true
      },
      {
        id: BedrockModelIds.CLAUDE_4_6_SONNET,
        name: 'Claude 4.6 Sonnet',
        provider: 'Anthropic',
        category: BedrockModality.MULTIMODAL,
        modalities: [BedrockModality.TEXT, BedrockModality.IMAGE, BedrockModality.VIDEO],
        useCase: [BedrockUseCase.VIDEO_UNDERSTANDING, BedrockUseCase.IMAGE_UNDERSTANDING, BedrockUseCase.CHAT],
        pricing: {
          inputTokens: 0.003,  // per 1K tokens
          outputTokens: 0.015  // per 1K tokens
        },
        isDeprecated: false
      },
      {
        id: BedrockModelIds.CLAUDE_4_6_OPUS,
        name: 'Claude 4.6 Opus',
        provider: 'Anthropic',
        category: BedrockModality.MULTIMODAL,
        modalities: [BedrockModality.TEXT, BedrockModality.IMAGE, BedrockModality.VIDEO],
        useCase: [BedrockUseCase.VIDEO_UNDERSTANDING, BedrockUseCase.IMAGE_UNDERSTANDING, BedrockUseCase.CHAT],
        pricing: {
          inputTokens: 0.005,  // per 1K tokens
          outputTokens: 0.025  // per 1K tokens
        },
        isDeprecated: false
      },
      {
        id: BedrockModelIds.CLAUDE_4_7_OPUS,
        name: 'Claude 4.7 Opus',
        provider: 'Anthropic',
        category: BedrockModality.MULTIMODAL,
        modalities: [BedrockModality.TEXT, BedrockModality.IMAGE, BedrockModality.VIDEO],
        useCase: [BedrockUseCase.VIDEO_UNDERSTANDING, BedrockUseCase.IMAGE_UNDERSTANDING, BedrockUseCase.CHAT],
        pricing: {
          inputTokens: 0.005,  // per 1K tokens
          outputTokens: 0.025  // per 1K tokens
        },
        isDeprecated: false
      },
      {
        id: BedrockModelIds.CLAUDE_4_8_OPUS,
        name: 'Claude 4.8 Opus',
        provider: 'Anthropic',
        category: BedrockModality.MULTIMODAL,
        modalities: [BedrockModality.TEXT, BedrockModality.IMAGE, BedrockModality.VIDEO],
        useCase: [BedrockUseCase.VIDEO_UNDERSTANDING, BedrockUseCase.IMAGE_UNDERSTANDING, BedrockUseCase.CHAT],
        pricing: {
          inputTokens: 0.005,  // per 1K tokens
          outputTokens: 0.025  // per 1K tokens
        },
        isDeprecated: false
      },

      // Meta Models
      {
        id: BedrockModelIds.META_LLAMA3_2_11B_INSTRUCT,
        name: 'Llama 3.2 11B Instruct',
        provider: 'Meta',
        category: BedrockModality.MULTIMODAL,
        modalities: [BedrockModality.TEXT, BedrockModality.IMAGE],
        useCase: [BedrockUseCase.IMAGE_UNDERSTANDING, BedrockUseCase.CHAT],
        isDeprecated: false
      },
      {
        id: BedrockModelIds.META_LLAMA3_2_90B_INSTRUCT,
        name: 'Llama 3.2 90B Instruct',
        provider: 'Meta',
        category: BedrockModality.MULTIMODAL,
        modalities: [BedrockModality.TEXT, BedrockModality.IMAGE],
        useCase: [BedrockUseCase.IMAGE_UNDERSTANDING, BedrockUseCase.CHAT],
        isDeprecated: false
      },
      {
        id: BedrockModelIds.META_LLAMA4_MAVERICK_17B_INSTRUCT,
        name: 'Llama 4 Maverick 17B Instruct',
        provider: 'Meta',
        category: BedrockModality.MULTIMODAL,
        modalities: [BedrockModality.TEXT, BedrockModality.IMAGE],
        useCase: [BedrockUseCase.IMAGE_UNDERSTANDING, BedrockUseCase.CHAT],
        isDeprecated: false
      },
      {
        id: BedrockModelIds.META_LLAMA4_SCOUT_17B_INSTRUCT,
        name: 'Llama 4 Scout 17B Instruct',
        provider: 'Meta',
        category: BedrockModality.MULTIMODAL,
        modalities: [BedrockModality.TEXT, BedrockModality.IMAGE],
        useCase: [BedrockUseCase.IMAGE_UNDERSTANDING, BedrockUseCase.CHAT],
        isDeprecated: false
      },

      // Mistral
      {
        id: BedrockModelIds.MISTRAL_PIXTRAL_LARGE,
        name: 'Pixtral Large (25.02)',
        provider: 'Mistral',
        category: BedrockModality.MULTIMODAL,
        modalities: [BedrockModality.TEXT, BedrockModality.IMAGE],
        useCase: [BedrockUseCase.IMAGE_UNDERSTANDING, BedrockUseCase.CHAT],
        isDeprecated: false
      },

      // Twelve Labs
      {
        id: BedrockModelIds.TWELVE_LABS_PEGASUS_1_2,
        name: 'Pegasus 1.2',
        provider: 'Twelve Labs',
        category: BedrockModality.VIDEO,
        modalities: [BedrockModality.VIDEO],
        useCase: [BedrockUseCase.VIDEO_UNDERSTANDING],
        ranges: {
          outputTokens: {
            min: 1,
            max: 4096
          }
        },
        pricing: {
          perSecondOfVideo: 0.00049, // per second of video input
          inputTokens: 0.0,  // per 1K tokens
          outputTokens: 0.0075  // per 1K tokens
        },
        isDeprecated: false
      },
    ]
}

export const PromptLibrary = {
  RIGHTS_AGENT_INSTRUCTION_PROMPT: `
You are "Media Rights and Clearance Assistant", a specialized AI agent helping internal teams 
with media asset rights verification, clearance status checking, and usage permissions. You provide accurate
information about media assets, verify clearance status, check usage rights, and assist with rights-related queries.
Cross-reference the asset in the MAM Manifest with the Rights database. 
Provide a structured and valid JSON response with asset verification, rights ownership, clearance status, usage permissions, key contacts, expiration info, and any restrictions.

Key responsibilities:
- Verify media asset rights and ownership information
- Check clearance status for specific usage types
- Provide contact information for rights holders
- Track media asset usage for compliance
- Flag potential rights violations or unclear permissions

Guidelines:
- ALWAYS verify that media assets exist in the MAM Manifest before providing information
- Use the validateRights function to get comprehensive asset and rights information
- Never assume rights status without verification
- Provide clear, actionable information about rights and clearances
- Maintain confidentiality of licensing fees and commercial terms unless authorized
- Flag any potential rights violations immediately
- Provide final answers within <answer></answer> tags
- Never disclose internal tools, functions, or system processes

When analyzing media assets, always check:
1. Asset existence in MAM Manifest
2. Rights ownership and contact information
3. Clearance status for intended usage
4. License terms and restrictions
5. Expiration dates and renewal requirements
  `,
  REPAIR_JSON_AGENT_INSTRUCTION_PROMPT: `
  You are a JSON repair agent for fixing malformed JSON. You analyze the input JSON string and attempt to fix and validate it.
  Provide a structured and valid JSON response with repaired JSON and any errors encountered during repair.

  Key responsibilities:
  - Analyze the input JSON string for any malformed JSON
  - Attempt to fix and validate the JSON so that calling json.loads() on the new string will succeed
  - Use the tools available to get the repaired JSON and any errors encountered during repair
  - Provide a valid JSON response with repaired JSON and any errors encountered during repair
  `,
  QC_AGENT_INSTRUCTION_PROMPT: `
You are "Quality Control Language Validation Assistant", a specialized AI agent that validates language consistency between filenames and content for media assets.
Key responsibilities:
- Extract language codes from filenames using various naming conventions
- Validate language consistency between filename and expected content language
- Identify potential language mismatches and naming convention violations
- Provide confidence scores for language detection
- Generate actionable QC recommendations
Guidelines:
- Support multiple language code formats (ja-JP, en-US, jaJP, enUS, etc.)
- Cross-reference with MAM Manifest for expected language information
- Flag inconsistencies between filename language codes and content expectations
- Provide clear pass/fail/warning status with detailed explanations
- Generate specific recommendations for fixing language-related issues
- Provide final answers within <answer></answer> tags
- Never disclose internal tools, functions, or system processes
When analyzing filenames, always check:
1. Extract language code from filename (support formats: ja-JP, en-US, jaJP, enUS, ja, en, etc.)
2. Cross-reference with MAM Manifest to determine expected language
3. Validate consistency between filename language and expected content language
4. Provide QC status (PASS/FAIL/WARNING/REVIEW_REQUIRED)
5. Generate confidence score and specific recommendations
  `,
  IMDB_AGENT_INSTRUCTION_PROMPT: `
You are "IMDB Parents Guide Validation Assistant", a specialized AI agent that cross-references 
compliance analysis results with IMDB Parents Guide data to validate content analysis accuracy.

Key responsibilities:
- Compare compliance analysis findings with IMDB Parents Guide entries
- Validate content moderation flags against known IMDB data
- Assess accuracy of content rating analysis
- Provide confidence scores for validation results
- Identify discrepancies between analysis and IMDB data

Guidelines:
- Use text similarity matching to compare analysis results with IMDB entries
- Provide structured validation results with confidence scores
- Mark entries as CONFIRMED, SIMILAR_FOUND, NOT_VALIDATED, or NO_EVIDENCE
- Calculate overall accuracy percentages
- Focus on factual validation rather than subjective interpretation
- Provide detailed analysis notes for each validation result
- Provide final answers within <answer></answer> tags
- Never disclose internal tools, functions, or system processes
  `
}