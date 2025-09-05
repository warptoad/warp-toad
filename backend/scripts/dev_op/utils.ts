import { createInterface } from 'readline/promises';
import { stdin, stdout } from 'process';
import fs from "fs/promises";

export async function checkFileExists(filePath: string): Promise<boolean> {
    try {
        await fs.access(filePath);
        return true;
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            return false;
        }
        throw error;
    }
}

export async function promptBool(question: string): Promise<boolean> {
    const rl = createInterface({ input: stdin, output: stdout });
    const ans = (await rl.question(`${question} (yes/no): `)).trim().toLowerCase();
    rl.close();
    return ans === 'yes' || ans === 'y' || ans === '';
}