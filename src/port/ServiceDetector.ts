import * as fs from 'fs/promises';
import * as path from 'path';

export type ServiceType = 'frontend' | 'backend' | 'admin' | 'api' | 'unknown';

export interface ServiceInfo {
	name: string;
	type: ServiceType;
	location: string;
}

const SERVICE_PATTERNS: Record<ServiceType, RegExp> = {
	frontend: /(front|web|ui)/i,
	backend: /(back|api|server)/i,
	admin: /(admin|cms)/i,
	api: /api/i,
	unknown: /.^/, // never matches
};

export class ServiceDetector {
	async detect(worktreePath: string): Promise<ServiceInfo[]> {
		const entries = await fs.readdir(worktreePath, { withFileTypes: true });
		return entries
			.filter((entry) => entry.isDirectory())
			.map((entry) => ({
				name: entry.name,
				type: this.resolveType(entry.name),
				location: path.join(worktreePath, entry.name),
			}));
	}

	private resolveType(name: string): ServiceType {
		const match = Object.entries(SERVICE_PATTERNS).find(([, pattern]) =>
			pattern.test(name),
		);
		return (match?.[0] as ServiceType) ?? 'unknown';
	}
}
