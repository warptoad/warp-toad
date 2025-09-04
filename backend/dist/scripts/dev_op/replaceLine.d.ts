export interface lineReplacement {
    original: string;
    replacement: string;
}
export declare function lineReplacer(filePath: string, lineReplacements: lineReplacement[]): Promise<void>;
