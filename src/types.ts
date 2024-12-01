export interface ImageGenerationRequestParams {
    prompt: string;
    imageName?: string;
    shouldSaveToFile?: boolean;
}

export function isValidImageGenerationArgs(args: any): args is ImageGenerationRequestParams {
    return typeof args === "object" &&
        args !== null &&
        "prompt" in args &&
        typeof args.prompt === 'string';  
}