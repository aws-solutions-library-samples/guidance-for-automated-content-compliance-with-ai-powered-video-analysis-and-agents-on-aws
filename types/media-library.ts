export interface IMediaLibraryItem {
    s3Id: string;
    alt: string;
    imageUrl: string;
    originalFilename: string;
    type: string;
    size: string;
    lastModified: Date;
    s3Key: string;
}

export class MediaLibraryItem implements IMediaLibraryItem {
    constructor(
        public s3Id: string,
        public alt: string,
        public imageUrl: string,
        public originalFilename: string,
        public type: string,
        public size: string,
        public lastModified: Date,
        public s3Key: string
    ) {}
}

export interface IMediaLibraryReducerAction {
    type: string;
    payload: IMediaLibraryItem[];
}