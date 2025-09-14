// Service Interface Exports
// 
// These interfaces define the contracts for each domain service.
// They follow the deep modules principle: simple interfaces hiding complex implementations.

export type { ISettingsService } from './settings.service.interface';
export type { IUploadService, TaskImage, UploadResult } from './upload.service.interface';
export type { IGitService, GitOperationOptions, GitOperationResult } from './git.service.interface';
export type { ITerminalService, CreateTerminalOptions, TerminalTabUpdate, CreateTerminalResult } from './terminal.service.interface';
export type { IPullRequestService } from './pull-request.service.interface';
export type { IProjectService, CreateProjectData, ProjectPlanning, ProjectDashboard } from './project.service.interface';
export type { ITaskService, TaskListOptions, TaskUpdateData, CommitHistory } from './task.service.interface';

// Re-export common result types that are shared across services
export type { GitOperationResult as GitResult } from './project.service.interface';