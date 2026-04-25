export interface CheckItem {
    file: string;
    line?: number;
    message: string;
    severity: 'error' | 'warning' | 'info';
}

export interface CheckResult {
    name: string;
    status: 'pass' | 'fail' | 'warn' | 'skip';
    details: string;
    items: CheckItem[];
}
