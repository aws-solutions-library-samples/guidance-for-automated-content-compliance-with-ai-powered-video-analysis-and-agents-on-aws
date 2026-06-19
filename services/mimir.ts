import { post } from 'aws-amplify/api';
import { fetchAuthSession } from 'aws-amplify/auth';
import { v4 as uuidv4 } from 'uuid';
import outputs from '../amplify_outputs.json';

interface TimelineEvent {
  timestamp: number;
  frame: string;
  flags: Array<Record<string, string>>;
}

export interface MimirPushResponse {
  success: boolean;
  message: string;
  totalItems?: number;
  error?: string;
}

// Allowed classification types for Mimir
const ALLOWED_TYPES = [
  'PROFANITY', 'VIOLENCE', 'HATE', 'HARM',
  'ALCOHOL', 'ADULT', 'DRUG', 'EXPLICIT_PROFANITY',
];

/**
 * Normalize a classification type to Mimir format.
 * Unsupported types are mapped to 'OTHER'.
 */
function normalizeType(originalType: string): string {
  const normalized = originalType.toUpperCase().replace(/ /g, '_').replace(/-/g, '_');
  return ALLOWED_TYPES.includes(normalized) ? normalized : 'OTHER';
}

export class MimirService {
  /**
   * Convert timeline events from the dashboard into Mimir timed metadata format.
   *
   * Output format:
   * { items: { property1: { id, startMs, endMs, data: { formId, formData } }, ... } }
   */
  static convertToMimirFormat(events: TimelineEvent[]): { items: Record<string, any> } {
    const mimirItems: Record<string, any> = {};
    const sessionUUID = uuidv4();
    let sequentialCounter = 7000;
    let propertyCounter = 1;

    for (const event of events) {
      for (const flag of event.flags) {
        const flagType = Object.keys(flag)[0];
        const flagValue = flag[flagType];

        // Resolve description — if the value is purely numeric, use the type name as description
        let description = flagValue;
        if (!isNaN(Number(flagValue))) {
          description = flagType;
        }

        const timestampMs = Math.floor(event.timestamp * 1000);
        const normalizedType = normalizeType(flagType);
        const uniqueId = `${sessionUUID}-${timestampMs}-${sequentialCounter}`;

        mimirItems[`property${propertyCounter}`] = {
          id: uniqueId,
          startMs: timestampMs,
          endMs: timestampMs + 1000,
          data: {
            formId: 'Compliance',
            formData: {
              [normalizedType]: description,
            },
          },
        };

        sequentialCounter++;
        propertyCounter++;
      }
    }

    return { items: mimirItems };
  }

  /**
   * Push pre-converted Mimir payload to the Mimir API via the backend Lambda proxy.
   * The Lambda fetches the Mimir bearer token from SSM and forwards the payload.
   */
  static async pushToMimir(
    timelineEvents: TimelineEvent[],
    videoId: string,
    options?: { itemId?: string }
  ): Promise<MimirPushResponse> {
    const session = await fetchAuthSession();
    const token = session.tokens?.idToken;

    if (!token) {
      throw new Error('No valid authentication token available. Please sign in.');
    }

    // Convert on the frontend — Lambda just proxies to Mimir
    const mimirData = MimirService.convertToMimirFormat(timelineEvents);
    const totalItems = Object.keys(mimirData.items).length;

    const { body } = await post({
      apiName: outputs.custom.apiName,
      path: 'mimir-push',
      options: {
        headers: {
          Authorization: token.toString(),
        },
        body: {
          mimir_data: mimirData,
          item_id: options?.itemId || '',
        } as any,
      },
    }).response;

    const result = (await body.json()) as unknown as MimirPushResponse;
    return { ...result, totalItems };
  }
}
