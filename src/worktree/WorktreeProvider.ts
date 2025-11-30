import * as path from 'path';
import * as vscode from 'vscode';
import { ColorGenerator } from '../color/ColorGenerator';
import { ThemeUpdater } from '../color/ThemeUpdater';
import { PortAllocator } from '../port/PortAllocator';
import { ServiceDetector } from '../port/ServiceDetector';
import { EnvMap, EnvWriter } from '../utils/EnvWriter';
import { GitCLI } from '../utils/GitCLI';
import { WorktreeItem, WorktreeNode } from './WorktreeItem';
import { WorktreeScanner } from './WorktreeScanner';

const DEFAULT_BASE_PORTS: Record<string, number> = {
	frontend: 3000,
	backend: 4000,
	admin: 5000,
	api: 5500,
	unknown: 6000,
};

const RECENT_STORAGE_KEY = 'gitPortree.recentWorktrees';
const RECENT_LIMIT = 3;

interface RecentEntry {
	path: string;
	label: string;
	branch?: string;
}

interface WorktreeProviderDeps {
	rootPath: string;
	git: GitCLI;
	serviceDetector: ServiceDetector;
	portAllocator: PortAllocator;
	scanner: WorktreeScanner;
	colorGenerator: ColorGenerator;
	themeUpdater: ThemeUpdater;
	envWriter: EnvWriter;
	memento: vscode.Memento;
}

export class WorktreeProvider
	implements vscode.TreeDataProvider<WorktreeItem>, vscode.Disposable
{
	private readonly changeEmitter = new vscode.EventEmitter<WorktreeItem | void>();
	readonly onDidChangeTreeData = this.changeEmitter.event;

	private readonly rootPath: string;
	private readonly git: GitCLI;
	private readonly portAllocator: PortAllocator;
	private readonly scanner: WorktreeScanner;
	private readonly colorGenerator: ColorGenerator;
	private readonly themeUpdater: ThemeUpdater;
	private readonly envWriter: EnvWriter;
	private readonly memento?: vscode.Memento;
	private readonly disposables: vscode.Disposable[] = [];
	private readonly watchers: vscode.FileSystemWatcher[] = [];

	constructor(deps: Partial<WorktreeProviderDeps> = {}) {
		this.rootPath = deps.rootPath ?? WorktreeProvider.resolveWorkspaceRoot();
		this.git = deps.git ?? new GitCLI(this.rootPath);
		const serviceDetector = deps.serviceDetector ?? new ServiceDetector();
		this.portAllocator =
			deps.portAllocator ??
			new PortAllocator(serviceDetector, {
				basePorts: DEFAULT_BASE_PORTS,
			});
		this.envWriter = deps.envWriter ?? new EnvWriter(this.rootPath);
		this.colorGenerator = deps.colorGenerator ?? new ColorGenerator();
		this.themeUpdater = deps.themeUpdater ?? new ThemeUpdater();
		this.scanner =
			deps.scanner ??
			new WorktreeScanner({
				rootPath: this.rootPath,
				git: this.git,
				portAllocator: this.portAllocator,
			});
		this.memento = deps.memento;
		this.registerWatchers();
	}

	dispose(): void {
		this.disposables.forEach((disposable) => disposable.dispose());
		this.watchers.forEach((watcher) => watcher.dispose());
		this.changeEmitter.dispose();
	}

	refresh(): void {
		this.changeEmitter.fire();
	}

	async open(item: WorktreeItem): Promise<void> {
		if (!item?.resourceUri) {
			return;
		}
		if (item.node.branch) {
			await this.applyColor(item.node.branch);
		}
		await vscode.commands.executeCommand('vscode.openFolder', item.resourceUri, true);
		this.trackRecent(item.node);
	}

	async create(): Promise<void> {
		const reference = await this.pickReferenceBranch();
		if (!reference) {
			return;
		}

		const branch = await vscode.window.showInputBox({
			prompt: `Enter a branch name for the worktree (base: ${reference})`,
			placeHolder: 'feature/my-branch',
			ignoreFocusOut: true,
		});
		if (!branch) {
			return;
		}

		const sanitizedBranch = this.sanitize(branch);
		const suggestedPath = path.join(this.rootPath, 'worktrees', sanitizedBranch);
		const targetPath = await vscode.window.showInputBox({
			prompt: 'Choose a worktree path',
			value: suggestedPath,
			ignoreFocusOut: true,
		});
		if (!targetPath) {
			return;
		}

		try {
			const localBranchRef = `refs/heads/${branch}`;
			const branchExists = await this.git.hasRef(localBranchRef);
			const createBranchArgs: string[] = [];
			let referenceTarget = branch;
			if (!branchExists) {
				referenceTarget = reference;
				createBranchArgs.push('-b', branch);
			}

			const currentCount = (await this.scanner.scan()).length;
			await this.git.run(['worktree', 'add', ...createBranchArgs, targetPath, referenceTarget]);
			if (!branchExists) {
				await this.git.markManagedBranch(branch);
				await this.git.setBranchBase(branch, referenceTarget);
			}
			await this.configurePorts(targetPath, currentCount);
			await this.applyColor(branch);
			await vscode.window.showInformationMessage(
				branchExists
					? `Worktree created for existing branch ${branch}`
					: `Worktree created with new branch ${branch} from ${referenceTarget}`,
			);
			this.refresh();
			const tempItem = new WorktreeItem({
				label: branch,
				path: targetPath,
				branch,
				contextValue: 'gitPortree.worktree',
			});
			await this.open(tempItem);
		} catch (error) {
			await vscode.window.showErrorMessage(`Failed to create worktree: ${this.formatError(error)}`);
		}
	}

	async remove(item: WorktreeItem): Promise<void> {
		if (!item?.resourceUri) {
			return;
		}

		const confirmation = await vscode.window.showWarningMessage(
			`Remove worktree ${item.label}?`,
			{ modal: true },
			'Confirm',
		);
		if (confirmation !== 'Confirm') {
			return;
		}

		try {
			await this.git.run(['worktree', 'remove', item.resourceUri.fsPath]);
			await vscode.window.showInformationMessage(`Removed worktree ${item.label}`);
			this.refresh();
		} catch (error) {
			await vscode.window.showErrorMessage(`Failed to remove worktree: ${this.formatError(error)}`);
		}
	}

	async deleteBranch(item?: WorktreeItem): Promise<void> {
		try {
			const nodes = await this.scanner.scan();
			const branchMap = this.groupNodesByBranch(nodes);
			let branch = item?.node.branch;
			if (!branch) {
				const managedBranches = Array.from(await this.git.listManagedBranches()).sort();
				if (managedBranches.length === 0) {
					await vscode.window.showInformationMessage(
						'No GitPortree-managed branches available to delete.',
					);
					return;
				}
				const pick = await vscode.window.showQuickPick(managedBranches, {
					placeHolder: 'Select a GitPortree-managed branch to delete',
				});
				if (!pick) {
					return;
				}
				branch = pick;
			}

			if (!branch) {
				await vscode.window.showWarningMessage('Select a branch to delete.');
				return;
			}

			if (!(await this.git.isBranchManaged(branch))) {
				await vscode.window.showWarningMessage(
					`Branch ${branch} isn't tracked as a GitPortree worktree branch.`,
				);
				return;
			}

			const branchNodes = branchMap.get(branch) ?? [];
			if (branchNodes.length > 1) {
				await vscode.window.showWarningMessage(
					`Branch ${branch} is active in multiple worktrees. Remove the extra worktrees before deleting the branch.`,
				);
				return;
			}

			let worktreePath = item?.resourceUri?.fsPath;
			if (!worktreePath && branchNodes[0]) {
				worktreePath = branchNodes[0].path;
			}

			const confirm = await vscode.window.showWarningMessage(
				worktreePath
					? `Delete branch ${branch} and remove the worktree at ${worktreePath}?`
					: `Delete branch ${branch}?`,
				{ modal: true },
				'Delete',
			);
			if (confirm !== 'Delete') {
				return;
			}

			if (worktreePath) {
				await this.git.run(['worktree', 'remove', worktreePath]);
			}

			await this.git.run(['branch', '-D', branch]);
			await this.git.unmarkManagedBranch(branch);
			await this.git.unsetBranchBase(branch);
			await vscode.window.showInformationMessage(
				worktreePath
					? `Removed worktree and deleted branch ${branch}.`
					: `Deleted branch ${branch}.`,
			);
			this.refresh();
		} catch (error) {
			await vscode.window.showErrorMessage(
				`Failed to delete branch: ${this.formatError(error)}`,
			);
		}
	}

	async copyPortInfo(item?: WorktreeItem): Promise<void> {
		if (!item) {
			await vscode.window.showInformationMessage('Select a worktree to copy port info.');
			return;
		}
		const services = item?.node?.services ?? [];
		if (services.length === 0) {
			await vscode.window.showInformationMessage('No services detected for this worktree yet.');
			return;
		}

		const text = services.map((service) => `${service.name}: ${service.port}`).join('\n');
		await vscode.env.clipboard.writeText(text);
		await vscode.window.showInformationMessage('Copied port information to clipboard.');
	}

	getTreeItem(element: WorktreeItem): vscode.TreeItem {
		return element;
	}

	async getChildren(element?: WorktreeItem): Promise<WorktreeItem[]> {
		if (element) {
			return element.children;
		}

		const nodes: WorktreeNode[] = await this.scanner.scan();
		const rootNodes: WorktreeNode[] = [];
		const recentNodes = this.getRecentNodes(nodes);
		if (recentNodes.length > 0) {
			rootNodes.push({
				label: 'Recent Worktrees',
				description: 'Last opened worktrees',
				path: this.rootPath,
				children: recentNodes,
				contextValue: 'gitPortree.section',
			});
		}
		rootNodes.push(...nodes);
		return rootNodes.map((node) => new WorktreeItem(node));
	}

	async changeWorktree(item?: WorktreeItem): Promise<void> {
		if (item) {
			await this.open(item);
			return;
		}

		const nodes = await this.scanner.scan();
		if (nodes.length === 0) {
			await vscode.window.showInformationMessage('No worktrees available.');
			return;
		}

		const items = nodes.map((node) => ({
			label: node.label,
			description: node.description,
			detail: node.path,
			node,
		}));
		const pick = await vscode.window.showQuickPick(items, {
			placeHolder: 'Select a worktree to switch to',
		});
		if (!pick) {
			return;
		}

		const tempItem = new WorktreeItem(pick.node);
		await this.open(tempItem);
	}

	private async configurePorts(worktreePath: string, offset: number): Promise<void> {
		const assignments = await this.portAllocator.assignPorts(worktreePath, offset);
		if (assignments.length === 0) {
			return;
		}

		const envValues: EnvMap = {};
		assignments.forEach((assignment) => {
			const key = `${assignment.service.name.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}_PORT`;
			envValues[key] = assignment.port;
		});
		if (!envValues.PORT && assignments[0]) {
			envValues.PORT = assignments[0].port;
		}

		await this.envWriter.write(path.join(worktreePath, '.env.local'), envValues);
	}

	private async applyColor(branch: string): Promise<void> {
		const generated = this.colorGenerator.generate(branch);
		await this.themeUpdater.apply(generated);
	}

	private async pickReferenceBranch(): Promise<string | undefined> {
		type ReferencePickItem = vscode.QuickPickItem & { value?: string; custom?: boolean };
		const refs = await this.git.listReferences(['refs/heads', 'refs/remotes']);
		const preferred = ['origin/main', 'origin/master', 'main', 'master'];
		const defaultRef = preferred.find((ref) => refs.includes(ref)) ?? refs[0] ?? 'HEAD';
		const items: ReferencePickItem[] = refs.map((ref) => ({
			label: ref,
			description: ref.startsWith('origin/') ? 'remote' : 'local',
			value: ref,
		}));
		items.push({
			label: 'Enter custom reference…',
			description: 'Type a branch, tag, or commit manually',
			alwaysShow: true,
			custom: true,
			value: defaultRef,
		});
		const pick = await vscode.window.showQuickPick(items, {
			placeHolder: 'Select the base branch or ref for this worktree',
			ignoreFocusOut: true,
		});
		if (!pick) {
			return undefined;
		}
		if ((pick as ReferencePickItem).custom) {
			return this.promptReferenceInput(pick.value ?? defaultRef);
		}
		return pick.value ?? pick.label;
	}

	private async promptReferenceInput(defaultRef: string): Promise<string | undefined> {
		return vscode.window.showInputBox({
			prompt: 'Base branch or commit (e.g. origin/main, develop, 1a2b3c4d)',
			placeHolder: 'origin/main',
			value: defaultRef,
			ignoreFocusOut: true,
		});
	}

	private groupNodesByBranch(nodes: WorktreeNode[]): Map<string, WorktreeNode[]> {
		const map = new Map<string, WorktreeNode[]>();
		nodes.forEach((node) => {
			if (!node.branch) {
				return;
			}
			const list = map.get(node.branch);
			if (list) {
				list.push(node);
			} else {
				map.set(node.branch, [node]);
			}
		});
		return map;
	}

	private sanitize(input: string): string {
		return input.replace(/[^a-zA-Z0-9._-]/g, '-');
	}

	private formatError(error: unknown): string {
		if (error instanceof Error) {
			return error.message;
		}
		return String(error);
	}

	private static resolveWorkspaceRoot(): string {
		return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd();
	}

	private registerWatchers(): void {
		try {
			const pattern = new vscode.RelativePattern(this.rootPath, '.git/worktrees/**');
			const watcher = vscode.workspace.createFileSystemWatcher(pattern);
			this.watchers.push(watcher);
			this.disposables.push(
				watcher.onDidChange(() => this.refresh()),
				watcher.onDidCreate(() => this.refresh()),
				watcher.onDidDelete(() => this.refresh()),
			);
		} catch (error) {
			console.warn('[WorktreeProvider] failed to register worktree watcher', error);
		}
	}

	private trackRecent(node: WorktreeNode): void {
		if (!this.memento) {
			return;
		}
		const entry: RecentEntry = {
			path: path.resolve(node.path),
			label: node.label,
			branch: node.branch,
		};
		const current = this.memento.get<RecentEntry[]>(RECENT_STORAGE_KEY, []);
		const next = [entry, ...current.filter((item) => item.path !== entry.path)];
		this.memento.update(RECENT_STORAGE_KEY, next.slice(0, RECENT_LIMIT));
	}

	private getRecentNodes(allNodes: WorktreeNode[]): WorktreeNode[] {
		if (!this.memento) {
			return [];
		}
		const entries = this.memento.get<RecentEntry[]>(RECENT_STORAGE_KEY, []);
		if (entries.length === 0) {
			return [];
		}
		const map = new Map<string, WorktreeNode>();
		allNodes.forEach((node) => {
			map.set(path.resolve(node.path), node);
		});
		const recentNodes: WorktreeNode[] = [];
		entries.forEach((entry) => {
			const match = map.get(path.resolve(entry.path));
			if (match) {
				recentNodes.push(match);
			}
		});
		return recentNodes;
	}
}
