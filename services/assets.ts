import { get, post } from 'aws-amplify/api';
import { uploadData, list, getProperties, remove, getUrl, downloadData } from 'aws-amplify/storage';
import { S3Client, PutObjectTaggingCommand } from '@aws-sdk/client-s3';
import { fetchAuthSession } from 'aws-amplify/auth';
import { vars } from '../amplify/global-variables';
import { v4 as uuidv4 } from 'uuid';
import { AuthService } from '../services/auth';
import { CommonUtils } from '../amplify/utils';
import outputs from "../amplify_outputs.json";
import { IGenerateVideoPlaybackAssetsRequest, IGenerateVideoPlaybackAssetsResponse } from '@/types/video-playback';
import { IMediaLibraryItem } from '@/types/media-library';
import { CONTENT_TYPES, BedrockModelIds } from '@/amplify/global-variables';

type ContentType = keyof typeof CONTENT_TYPES;

export interface UploadResult {
    file: File;
    status: 'success' | 'failed';
    response?: any;
    error?: any;
    key?: string;
    s3Uri?: string;
}

export class AssetsService {
    /**
     * Upload assets (videos and transcripts) directly to S3
     * Transcripts are uploaded to TRANSCRIPT_ASSETS path and tagged to video assets
     */
    async uploadAssets(videoFiles: File[], sessionId: string, transcriptFile?: File, contentType?: ContentType): Promise<UploadResult[]> {
        const results: UploadResult[] = [];
        let transcriptS3Uri: string | undefined;
        let transcriptS3Key: string | undefined;

        // Upload transcript first if provided (only one allowed)
        if (transcriptFile) {
            try {
                const fileExtension = transcriptFile.name.split('.').pop();
                const transcriptResult = await uploadData({
                    path: ({identityId}) => `${vars.API_PATHS.TRANSCRIPT_ASSETS}/${identityId}/${uuidv4()}.${fileExtension}`,
                    data: transcriptFile,
                    options: {
                        contentType: transcriptFile.type || 'text/plain',
                        metadata: {
                            [vars.S3_CUSTOM_METADATA.originalfilename]: transcriptFile.name,
                        }
                    }
                }).result;

                console.log('****');
                console.log(transcriptResult);
                
                transcriptS3Uri = `s3://${outputs.storage.bucket_name}/${transcriptResult.path}`;
                transcriptS3Key = transcriptResult.path;
                console.log(`Transcript upload succeeded for ${transcriptFile.name}:`, transcriptResult);
                
                results.push({
                    file: transcriptFile,
                    status: 'success',
                    response: transcriptResult,
                    key: transcriptResult.path,
                    s3Uri: transcriptS3Uri
                });
            } catch (error) {
                console.log(`Transcript upload failed for ${transcriptFile.name}:`, error);
                results.push({
                    file: transcriptFile,
                    status: 'failed',
                    error
                });
            }
        }

        // Upload video files
        const videoUploadPromises = videoFiles.map(async (file): Promise<UploadResult> => {
            try {
                const fileExtension = file.name.split('.').pop();
                const uploadResult = await uploadData({
                    path: ({identityId}) => `${vars.API_PATHS.VIDEO_ASSETS}/${identityId}/${uuidv4()}.${fileExtension}`,
                    data: file,
                    options: {
                        contentType: file.type || `video/${fileExtension}`,
                        metadata: {
                            [vars.S3_CUSTOM_METADATA.originalfilename]: file.name,
                        }
                    }
                }).result;

                // Extract video duration
                const duration = await this.getVideoDuration(file);

                // Add transcript S3 URI as object tag if available
                const tags: Record<string, string> = { 'SessionId': sessionId };
                if (transcriptS3Key) {
                    tags['TranscriptS3Key'] = transcriptS3Key;
                }
                if (contentType) {
                    tags['ContentType'] = CONTENT_TYPES[contentType];
                }
                if (duration) {
                    tags['DurationSeconds'] = duration.toString();
                }

                tags['OriginalFilename'] = file.name;

                await this.tagS3Object(uploadResult.path, tags);

                console.log('****');
                console.log(uploadResult);
                
                console.log(`Video upload succeeded for ${file.name}:`, uploadResult);
                return {
                    file,
                    status: 'success',
                    response: uploadResult,
                    key: uploadResult.path,
                    s3Uri: `s3://${outputs.storage.bucket_name}/${uploadResult.path}`
                };
            } catch (error) {
                console.log(`Video upload failed for ${file.name}:`, error);
                return {
                    file,
                    status: 'failed',
                    error
                };
            }
        });
    
        const videoResults = await Promise.all(videoUploadPromises);
        results.push(...videoResults);
    
        // Log summary
        const successful = results.filter(r => r.status === 'success');
        const failed = results.filter(r => r.status === 'failed');
    
        console.log(`Upload Summary:
            Total: ${results.length}
            Successful: ${successful.length}
            Failed: ${failed.length}
        `);
    
        if (failed.length > 0) {
            console.error('Failed uploads:', failed.map(f => f.file.name));
        }
    
        return results;
    }
    
    /**
     * Get the upload path for the current user
     */
    // private async getUploadPath(): Promise<string> {
    //     try {
    //         const { userId } = await AuthService.getCurrentUser();
    //         return userId;
    //     } catch (error) {
    //         console.error('Error getting upload path:', error);
    //         return 'anonymous';
    //     }
    // }

    /**
     * Extract video duration in seconds
     */
    private async getVideoDuration(file: File): Promise<number | null> {
        return new Promise((resolve) => {
            const objectUrl = URL.createObjectURL(file);
            const video = document.createElement('video');
            video.preload = 'metadata';

            // Guard so we only clean up once. Aborting the in-flight blob load
            // (removeAttribute + load) BEFORE revoking prevents the browser from
            // re-requesting a revoked blob URL, which was surfacing as a stray
            // "blob:... net::ERR_FILE_NOT_FOUND" on repeat uploads.
            let settled = false;
            const finish = (result: number | null) => {
                if (settled) return;
                settled = true;
                video.onloadedmetadata = null;
                video.onerror = null;
                video.removeAttribute('src');
                video.load();
                URL.revokeObjectURL(objectUrl);
                resolve(result);
            };

            video.onloadedmetadata = () => finish(Math.round(video.duration));
            video.onerror = () => finish(null);
            video.src = objectUrl;
        });
    }

    /**
     * Tag S3 object using AWS SDK
     */
    private async tagS3Object(key: string, tags: Record<string, string>): Promise<void> {
        try {
            const session = await fetchAuthSession();
            const s3Client = new S3Client({
                region: outputs.storage.aws_region,
                credentials: session.credentials
            });

            const tagSet = Object.entries(tags).map(([Key, Value]) => ({ Key, Value }));
            
            await s3Client.send(new PutObjectTaggingCommand({
                Bucket: outputs.storage.bucket_name,
                Key: key,
                Tagging: { TagSet: tagSet }
            }));
        } catch (error) {
            console.error('Error tagging S3 object:', error);
            throw error;
        }
    }

    // create a function to list the assets using the amplify list from s3
    static async listAssets(): Promise<IMediaLibraryItem[]> {
        try {
            const { items } = await list({
                path: ({identityId}) => `${vars.API_PATHS.VIDEO_ASSETS}/${identityId}/`
            });

            const mediaItems = [];

            for (const item of items) {
                const properties = await getProperties({
                    path: item.path
                });

                //console.log(properties);

                // get property key name for vars s3 metadata
                const filenameMetadataName = Object.keys(vars.S3_CUSTOM_METADATA).find(
                    //@ts-ignore
                    key => vars.S3_CUSTOM_METADATA[key] === vars.S3_CUSTOM_METADATA.originalfilename
                );

                const s3Id = item.path.split('/').pop() as string;
                
                // convert the items to media library items
                const mediaItem: IMediaLibraryItem = {
                    s3Id,
                    alt: item.path.split('/').pop() as string,
                    originalFilename: properties.metadata && filenameMetadataName ? properties.metadata[filenameMetadataName] : '',
                    imageUrl: await this.getAssetThumbnail(s3Id),
                    type: CommonUtils.getFileTypeOrExtension(item.path, properties.contentType),
                    size: item.size ? CommonUtils.getDisplayFriendlyFileSize(item.size) : 'unknown',
                    lastModified: properties.lastModified ? new Date(properties.lastModified) : new Date(),
                    s3Key: item.path
                };

                mediaItems.push(mediaItem);
            }

            return mediaItems;
        } catch (error) {
            console.error('Error listing assets:', error);
            throw error;
        }
    }

    static async getAssetThumbnail(s3Id: string): Promise<string> {
        try {
            // remove the extension from s3Id
            const s3IdWithoutExtension = s3Id.split('.')[0];
            const { items } = await list({
                path: ({identityId}) => `processed/video/${identityId}/${s3IdWithoutExtension}/thumbnails`,
                options: {
                    pageSize: 20
                }
            });

            if(items.length > 0) {
                const linkToThumbnail = await getUrl({
                    path: ({identityId}) => `processed/video/${identityId}/${s3IdWithoutExtension}/thumbnails/${items.pop()?.path.split('/').pop()}`,
                    options: {
                        validateObjectExistence: true, 
                        // url expiration time in seconds.
                        expiresIn: 86400,
                    }
                });

                return linkToThumbnail.url.toString();
            } else {
                return 'AWS_logo_white.svg';
            }
        } catch (error) {
            console.error('Error getting thumbnail:', error);
            throw error;
        }
    }


    static async getTranscript(s3TranscriptKey: string): Promise<string> {
        try {
            const transcriptData = await downloadData({
                path: s3TranscriptKey
            }).result;
            return await transcriptData.body.text();
        } catch (error) {
            console.error('Error getting transcript:', error);
            return '';
        }
    }

    static async getDetailedAnalysis(s3Id: string): Promise<any> {
        try {
            const s3IdWithoutExtension = s3Id.split('.')[0];
            const analysisData = await downloadData({
                path: ({identityId}) => `processed/video/${identityId}/${s3IdWithoutExtension}/thumbnails_analysis/detailed_analysis_report.json`
            }).result;
            const jsonText = await analysisData.body.text();
            return JSON.parse(jsonText);
        } catch (error) {
            console.error('Error getting detailed analysis file from S3:', error);
            return null;
        }
    }
}