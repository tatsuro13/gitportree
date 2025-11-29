import * as fs from 'fs/promises';
import * as path from 'path';
import { PortAllocator } from '../port/PortAllocator';
import { GitCLI } from '../utils/GitCLI';
import { WorktreeNode } from './WorktreeItem';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

interface WorktreeScannerDeps {
	rootPath: string;
	git: GitCLI;
	portAllocator: PortAllocator;
}

interface RawWorktree {
	path: string;
	branch?: string;
	head?: string;
}

export class WorktreeScanner {
	private gitDirPromise?: Promise<string>;

	constructor(private readonly deps: WorktreeScannerDeps) {}

	async scan(): Promise<WorktreeNode[]> {
		try {
			const output = await this.deps.git.run(['worktree', 'list', '--porcelain']);
			const worktrees = this.parseWorktreeList(output);
			const nodes: WorktreeNode[] = [];

			for (let index = 0; index < worktrees.length; index += 1) {
				const worktree = worktrees[index];
				const [createdAt, changes, assignments] = await Promise.all([
					this.getCreatedAt(worktree.path),
					this.countChanges(worktree.path),
					this.deps.portAllocator.assignPorts(worktree.path, index),
				]);

				const days = createdAt
					? Math.max(0, Math.floor((Date.now() - createdAt) / MS_PER_DAY))
					: undefined;
				const descriptionParts = [] as string[];
				if (typeof days === 'number') {
					descriptionParts.push(`${days}d`);
				}
				descriptionParts.push(`Δ${changes}`);

				const services = assignments.map((assignment) => ({
					name: assignment.service.name,
					port: assignment.port,
					type: assignment.service.type,
					location: assignment.service.location,
				}));
				const children: WorktreeNode[] = services.map((service) => ({
					label: service.name,
					description: `${service.port}`,
					path: service.location ?? path.join(worktree.path, service.name),
					contextValue: 'gitPortree.service',
				}));

				nodes.push({
					label: this.getDisplayName(worktree),
					description: descriptionParts.join(' · '),
					path: worktree.path,
					services,
					children,
					branch: this.getBranchName(worktree),
					offset: index,
					statusCount: changes,
					daysSinceCreated: days,
					createdAt,
					contextValue: 'gitPortree.worktree',
				});
			}

			return nodes;
		} catch (error) {
			console.error('[WorktreeScanner] failed to scan worktrees', error);
			return [];
		}
	}

	private parseWorktreeList(output: string): RawWorktree[] {
		const entries: RawWorktree[] = [];
		const lines = output.split(/\r?\n/);
		let current: RawWorktree | undefined;

		for (const line of lines) {
			if (!line.trim()) {
				if (current) {
					entries.push(current);
					current = undefined;
				}
				continue;
			}

			if (line.startsWith('worktree ')) {
				if (current) {
					entries.push(current);
				}
				current = { path: line.substring('worktree '.length).trim() };
				continue;
			}

			if (!current) {
				continue;
			}

			if (line.startsWith('branch ')) {
				current.branch = line.substring('branch '.length).trim();
			} else if (line.startsWith('HEAD ')) {
				current.head = line.substring('HEAD '.length).trim();
			}
		}

		if (current) {
			entries.push(current);
		}

		return entries;
	}

	private getDisplayName(worktree: RawWorktree): string {
		const branch = this.getBranchName(worktree);
		return branch ?? path.basename(worktree.path);
	}

	private getBranchName(worktree: RawWorktree): string | undefined {
		if (worktree.branch) {
			return worktree.branch.replace('refs/heads/', '');
		}
		return worktree.head;
	}

	private async countChanges(worktreePath: string): Promise<number> {
		try {
			const output = await this.deps.git.run([
				'-C',
				worktreePath,
				'status',
				'--porcelain',
			]);
			if (!output) {
				return 0;
			}
			return output.split(/\r?\n/).filter(Boolean).length;
		} catch (error) {
			console.error('[WorktreeScanner] failed to read git status', error);
			return 0;
		}
	}

	private async getCreatedAt(worktreePath: string): Promise<number | undefined> {
		try {
			const gitDir = await this.getGitDir();
			const worktreesDir = path.join(gitDir, 'worktrees');
			const entries = await fs.readdir(worktreesDir, { withFileTypes: true });
			const resolvedTarget = path.resolve(worktreePath);

			for (const entry of entries) {
				if (!entry.isDirectory()) {
					continue;
				}
				const configPath = path.join(worktreesDir, entry.name, 'config');
				let config: string;
				try {
					config = await fs.readFile(configPath, 'utf8');
					const worktreeLine = config
						.split(/\r?\n/)
						.find((line) => line.trim().startsWith('worktree = '));
					if (worktreeLine) {
						const declaredPath = worktreeLine.replace('worktree = ', '').trim();
						if (path.resolve(declaredPath) === resolvedTarget) {
							const createdLine = config
								.split(/\r?\n/)
								.find((line) => line.trim().startsWith('createdAt = '));
							if (createdLine) {
								const createdAtSeconds = Number(createdLine.replace('createdAt = ', '').trim());
								if (!Number.isNaN(createdAtSeconds)) {
									return createdAtSeconds * 1000;
								}
							}
						}
					}
				} catch (error) {
					const err = error as NodeJS.ErrnoException;
					if (err?.code !== 'ENOENT') {
						console.warn('[WorktreeScanner] failed to read worktree config', error);
					}
				}
			}
		} catch (error) {
			console.warn('[WorktreeScanner] unable to list worktree configs', error);
		}

		try {
			const stats = await fs.stat(worktreePath);
			return stats.birthtimeMs || stats.ctimeMs;
		} catch {
			return undefined;
		}
	}

	private async getGitDir(): Promise<string> {
		if (!this.gitDirPromise) {
			this.gitDirPromise = this.resolveGitDir();
		}
		return this.gitDirPromise;
	}

	private async resolveGitDir(): Promise<string> {
		const gitPath = path.join(this.deps.rootPath, '.git');
		try {
			const stats = await fs.stat(gitPath);
			if (stats.isDirectory()) {
				return gitPath;
			}
			const content = await fs.readFile(gitPath, 'utf8');
			const match = content.match(/gitdir:\s*(.*)/i);
			if (match?.[1]) {
				return path.resolve(this.deps.rootPath, match[1].trim());
			}
		} catch (error) {
			console.warn('[WorktreeScanner] unable to resolve .git directory', error);
		}
		return gitPath;
	}
}
