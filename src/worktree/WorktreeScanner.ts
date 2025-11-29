import { exec } from 'child_process';
import { promisify } from 'util';
import { WorktreeNode } from './WorktreeItem';

const execAsync = promisify(exec);

export class WorktreeScanner {
	constructor(private readonly cwd: string) {}

	async scan(): Promise<WorktreeNode[]> {
		try {
			await execAsync('git worktree list --porcelain', { cwd: this.cwd });
			// TODO: parse the command output into WorktreeNode objects
			return [];
		} catch (error) {
			console.error('[WorktreeScanner] failed to scan worktrees', error);
			return [];
		}
	}
}
