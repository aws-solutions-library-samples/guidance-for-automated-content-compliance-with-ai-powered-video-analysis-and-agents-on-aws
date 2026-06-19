export interface IGenerateVideoPlaybackAssetsRequest {
    s3BucketName: string;
    s3ObjectKey: string;
    userId: string;
}

export interface IGenerateVideoPlaybackAssetsResponse {
    duration: number;
    previewKey: string;
    thumbnailKeys: string[];
    segmentKeys: string[];
    playlistKey: string;
    hlsPath: string;
    outputPrefix: string;
}