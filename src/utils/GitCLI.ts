import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export class GitCLI {
	constructor(private readonly cwd: string) {}

	async run(args: string[]): Promise<string> {
		const { stdout } = await execFileAsync('git', args, { cwd: this.cwd });
		return stdout.trim();
	}

	async hasRef(ref: string): Promise<boolean> {
		try {
			await execFileAsync('git', ['rev-parse', '--verify', '--quiet', ref], {
				cwd: this.cwd,
			});
			return true;
		} catch {
			return false;
		}
	}
}
