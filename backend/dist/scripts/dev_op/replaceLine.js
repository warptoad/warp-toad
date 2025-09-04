"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.lineReplacer = lineReplacer;
const argparse_1 = require("argparse");
const promises_1 = __importDefault(require("fs/promises"));
async function lineReplacer(filePath, lineReplacements) {
    const file = await promises_1.default.open(filePath, "r");
    let newFile = "";
    for await (const line of file.readLines()) {
        const replacement = lineReplacements.find((replacement) => line.startsWith(replacement.original));
        if (replacement) {
            newFile += replacement.replacement + "\n";
        }
        else {
            newFile += line + "\n";
        }
    }
    await file.close();
    await promises_1.default.writeFile(filePath, newFile);
}
async function main() {
    const parser = new argparse_1.ArgumentParser({
        description: 'quick lil script to replace 1 line',
        usage: `yarn ts-node scripts_dev_op/replaceLine.ts --file contracts/evm/WithdrawVerifier.sol --remove "contract UltraVerifier is BaseUltraVerifier {" --replace "contract WithdrawVerifier is BaseUltraVerifier {"`
    });
    parser.add_argument('-f', '--file', { help: 'file to read', required: true, type: 'str' });
    parser.add_argument('-r', '--remove', { help: 'specify what line to replace', required: true, type: 'str' });
    parser.add_argument('-p', '--replace', { help: 'specify what to replace it with', required: true, type: 'str' });
    const args = parser.parse_args();
    const lineReplacements = [
        {
            "original": args.remove,
            "replacement": args.replace
        }
    ];
    await lineReplacer(args.file, lineReplacements);
}
if (require.main === module) {
    main();
}
