import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

interface BranchMetadata {
	managed: Set<string>;
	bases: Map<string, string>;
}

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

	async markManagedBranch(branch: string): Promise<void> {
		await this.run(['config', '--local', this.managedKey(branch), 'true']);
	}

	async unmarkManagedBranch(branch: string): Promise<void> {
		await this.unsetConfigKey(this.managedKey(branch));
	}

	async isBranchManaged(branch: string): Promise<boolean> {
		const { managed } = await this.readBranchMetadata();
		return managed.has(branch);
	}

	async listManagedBranches(): Promise<Set<string>> {
		const { managed } = await this.readBranchMetadata();
		return new Set(managed);
	}

	async setBranchBase(branch: string, base: string): Promise<void> {
		await this.run(['config', '--local', this.baseKey(branch), base]);
	}

	async unsetBranchBase(branch: string): Promise<void> {
		await this.unsetConfigKey(this.baseKey(branch));
	}

	async getBranchBase(branch: string): Promise<string | undefined> {
		const { bases } = await this.readBranchMetadata();
		return bases.get(branch);
	}

	async getBranchMetadata(): Promise<BranchMetadata> {
		const { managed, bases } = await this.readBranchMetadata();
		return {
			managed: new Set(managed),
			bases: new Map(bases),
		};
	}

	async listReferences(patterns: string[] = ['refs/heads']): Promise<string[]> {
		try {
			const args = ['for-each-ref', '--format=%(refname:short)', ...patterns];
			const output = await this.run(args);
			if (!output) {
				return [];
			}
			const seen = new Set<string>();
			const refs: string[] = [];
			output.split(/\r?\n/).forEach((line) => {
				const trimmed = line.trim();
				if (!trimmed || seen.has(trimmed)) {
					return;
				}
				seen.add(trimmed);
				refs.push(trimmed);
			});
			return refs;
		} catch (error) {
			console.warn('[GitCLI] failed to list refs', error);
			return [];
		}
	}

	private managedKey(branch: string): string {
		return `branch.${branch}.gitPortreeManaged`;
	}

	private baseKey(branch: string): string {
		return `branch.${branch}.gitPortreeBase`;
	}

	private async unsetConfigKey(key: string): Promise<void> {
		try {
			await this.run(['config', '--local', '--unset', key]);
		} catch {
			// ignore missing keys
		}
	}

	private async readBranchMetadata(): Promise<BranchMetadata> {
		try {
			const output = await this.run(['config', '--local', '--list']);
			const managed = new Set<string>();
			const bases = new Map<string, string>();
			if (!output) {
				return { managed, bases };
			}
			const managedSuffix = '.gitPortreeManaged';
			const baseSuffix = '.gitPortreeBase';
			output.split(/\r?\n/).forEach((line) => {
				const [rawKey, rawValue = ''] = line.split('=', 2);
				if (!rawKey?.startsWith('branch.')) {
					return;
				}
				const branchName = rawKey.slice('branch.'.length);
				if (branchName.endsWith(managedSuffix)) {
					const branch = branchName.slice(0, branchName.length - managedSuffix.length);
					if (rawValue.trim() === 'true' && branch) {
						managed.add(branch);
					}
					return;
				}
				if (branchName.endsWith(baseSuffix)) {
					const branch = branchName.slice(0, branchName.length - baseSuffix.length);
					if (branch && rawValue.trim()) {
						bases.set(branch, rawValue.trim());
					}
				}
			});
			return { managed, bases };
		} catch (error) {
			console.warn('[GitCLI] failed to read branch metadata', error);
			return { managed: new Set(), bases: new Map() };
		}
	}
}
