export type CommissionType = 'percentage' | 'fixed';
export type SplitMode = 'auto' | 'manual';
export type CommissionSourceType = 'normal_sale' | 'package_redeem';

export interface SplitAssignmentInput {
    staffId: string;
    percentage?: number;
    porsiPersen?: number;
    staffCommissionRate?: number;
}

export interface SplitAssignmentOutput {
    staffId: string;
    percentage: number;
    porsiPersen: number;
    komisiNominal: number;
}

export interface CalculateSplitCommissionParams {
    splitMode: SplitMode;
    assignments: SplitAssignmentInput[];
    servicePrice: number;
    quantity?: number;
    commissionType?: CommissionType;
    commissionValue?: number;
    sourceType?: CommissionSourceType;
}

export interface CalculateSplitCommissionResult {
    isValid: boolean;
    errors: string[];
    totalCommission: number;
    assignments: SplitAssignmentOutput[];
}

const SPLIT_TOLERANCE = 0.01;

const toNum = (value: unknown): number => {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
};

const roundTwo = (value: number): number => Math.round(value * 100) / 100;

const getEqualSplitPercentages = (count: number): number[] => {
    if (count <= 0) return [];
    if (count === 1) return [100];

    const base = Math.floor((100 / count) * 100) / 100;
    const percentages = Array.from({ length: count }, () => base);
    const currentTotal = percentages.reduce((sum, pct) => sum + pct, 0);
    percentages[count - 1] = roundTwo(percentages[count - 1] + (100 - currentTotal));
    return percentages;
};

export const calculateSplitCommission = (
    params: CalculateSplitCommissionParams
): CalculateSplitCommissionResult => {
    const {
        splitMode,
        servicePrice,
        quantity = 1,
        commissionType = 'fixed',
        commissionValue = 0,
    } = params;

    const sourceType = params.sourceType || 'normal_sale';

    const normalizedAssignments = (params.assignments || [])
        .map((assignment) => ({
            staffId: String(assignment.staffId || '').trim(),
            percentage: toNum(assignment.porsiPersen ?? assignment.percentage),
            staffCommissionRate: Math.max(0, toNum(assignment.staffCommissionRate)),
        }))
        .filter((assignment) => assignment.staffId.length > 0);

    if (normalizedAssignments.length === 0) {
        return {
            isValid: false,
            errors: ['Minimal 1 staff harus di-assign'],
            totalCommission: 0,
            assignments: [],
        };
    }

    const duplicateCheck = new Set<string>();
    for (const assignment of normalizedAssignments) {
        if (duplicateCheck.has(assignment.staffId)) {
            return {
                isValid: false,
                errors: ['Staff duplikat tidak diperbolehkan'],
                totalCommission: 0,
                assignments: [],
            };
        }
        duplicateCheck.add(assignment.staffId);
    }

    const withPercentages = splitMode === 'auto'
        ? normalizedAssignments.map((assignment, index) => ({
            ...assignment,
            percentage: getEqualSplitPercentages(normalizedAssignments.length)[index] || 0,
        }))
        : normalizedAssignments;

    for (const assignment of withPercentages) {
        if (assignment.percentage <= 0) {
            return {
                isValid: false,
                errors: ['Setiap porsi staff harus lebih dari 0%'],
                totalCommission: 0,
                assignments: [],
            };
        }
    }

    const totalPercentage = withPercentages.reduce((sum, assignment) => sum + assignment.percentage, 0);
    if (Math.abs(totalPercentage - 100) > SPLIT_TOLERANCE) {
        return {
            isValid: false,
            errors: ['Total porsi staff wajib tepat 100%'],
            totalCommission: 0,
            assignments: [],
        };
    }

    const serviceBaseAmount = Math.max(0, toNum(servicePrice) * Math.max(1, toNum(quantity)));

    // package_redeem tetap pakai base nilai service, bukan amount paid.
    const isPackageRedeem = sourceType === 'package_redeem';
    if (isPackageRedeem) {
        // no-op: base komisi tetap dari serviceBaseAmount
    }

    const normalizedQuantity = Math.max(1, toNum(quantity));

    // Commission source: service master only.
    const serviceCommissionNominal = commissionType === 'percentage'
        ? roundTwo((serviceBaseAmount * Math.max(0, toNum(commissionValue))) / 100)
        : roundTwo(Math.max(0, toNum(commissionValue)) * normalizedQuantity);

    const hasServiceRule = serviceCommissionNominal > 0;

    let outputs: SplitAssignmentOutput[] = [];

    if (hasServiceRule) {
        const totalServiceCommission = serviceCommissionNominal;

        outputs = withPercentages.map((assignment) => {
            const komisiNominal = roundTwo((totalServiceCommission * assignment.percentage) / 100);
            return {
                staffId: assignment.staffId,
                percentage: assignment.percentage,
                porsiPersen: assignment.percentage,
                komisiNominal,
            };
        });
    } else {
        outputs = withPercentages.map((assignment) => ({
            staffId: assignment.staffId,
            percentage: assignment.percentage,
            porsiPersen: assignment.percentage,
            komisiNominal: 0,
        }));
    }

    return {
        isValid: true,
        errors: [],
        totalCommission: roundTwo(outputs.reduce((sum, assignment) => sum + assignment.komisiNominal, 0)),
        assignments: outputs,
    };
};
