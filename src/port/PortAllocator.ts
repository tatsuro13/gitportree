import { ServiceDetector, ServiceInfo } from './ServiceDetector';

export interface PortAssignment {
	service: ServiceInfo;
	port: number;
}

export interface PortAllocatorOptions {
	basePorts: Record<string, number>;
	maxOffset?: number;
	zoneSize?: number;
}

export class PortAllocator {
	constructor(
		private readonly detector: ServiceDetector,
		private readonly options: PortAllocatorOptions,
	) {}

	async assignPorts(worktreePath: string, offset = 0): Promise<PortAssignment[]> {
		const services = await this.detector.detect(worktreePath);
		const normalizedOffset = this.normalizeOffset(offset);
		return services.map((service) => ({
			service,
			port: this.calculatePort(service, normalizedOffset),
		}));
	}

	private calculatePort(service: ServiceInfo, offset: number): number {
		const zone = this.options.basePorts[service.type] ?? 3000;
		const zoneSize = this.options.zoneSize ?? 100;
		const offsetWithinZone = ((offset % zoneSize) + zoneSize) % zoneSize;
		const hash = this.hash(service.name);
		const withinZone = hash % zoneSize;
		return zone + ((withinZone + offsetWithinZone) % zoneSize);
	}

	private normalizeOffset(offset: number): number {
		const { maxOffset } = this.options;
		if (typeof maxOffset === 'number' && maxOffset > 0) {
			return offset % maxOffset;
		}
		return offset;
	}

	private hash(value: string): number {
		let h = 0;
		for (let i = 0; i < value.length; i += 1) {
			h = (Math.imul(31, h) + value.charCodeAt(i)) | 0;
		}
		return Math.abs(h);
	}
}
