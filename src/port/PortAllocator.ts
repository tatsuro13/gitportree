import { ServiceDetector, ServiceInfo } from './ServiceDetector';

export interface PortAssignment {
	service: ServiceInfo;
	port: number;
}

export interface PortAllocatorOptions {
	basePorts: Record<string, number>;
	maxOffset?: number;
}

export class PortAllocator {
	constructor(
		private readonly detector: ServiceDetector,
		private readonly options: PortAllocatorOptions,
	) {}

	async assignPorts(worktreePath: string, offset = 0): Promise<PortAssignment[]> {
		const services = await this.detector.detect(worktreePath);
		return services.map((service) => ({
			service,
			port: this.calculatePort(service, offset),
		}));
	}

	private calculatePort(service: ServiceInfo, offset: number): number {
		const zone = this.options.basePorts[service.type] ?? 3000;
		const hash = this.hash(service.name);
		const withinZone = hash % 100;
		return zone + withinZone + offset;
	}

	private hash(value: string): number {
		let h = 0;
		for (let i = 0; i < value.length; i += 1) {
			h = (Math.imul(31, h) + value.charCodeAt(i)) | 0;
		}
		return Math.abs(h);
	}
}
