export interface InstallPaths {
    skillDir: string;
    helpersDir: string;
    agentsDir: string;
    presetsDir: string;
}
export declare function resolveInstallPaths(scope: 'global' | 'project', home?: string, cwd?: string): InstallPaths;
interface FileMapping {
    src: string;
    dest: string;
}
export declare function collectFiles(packageRoot: string): FileMapping[];
export declare function installSkill(scope?: 'global' | 'project'): Promise<void>;
export {};
