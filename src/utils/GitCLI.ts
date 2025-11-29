import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class GitCLI {
	constructor(private readonly cwd: string) {}

	async run(args: string[]): Promise<string> {
		const command = ['git', ...args].join(' ');
		const result = await execAsync(command, { cwd: this.cwd });
		return result.stdout.trim();
	}
}
