export type Priority = 1 | 2 | 3 | 4;

export type Task = {
	id: number;
	title: string;
	notes: string | null;
	project: string | null;
	priority: Priority;
	dueAt: string | null;
	completedAt: string | null;
	createdAt: string;
	labels: string[];
};

export type NewTask = {
	title: string;
	notes?: string | null;
	project?: string | null;
	priority?: Priority;
	dueAt?: string | null;
	labels?: string[];
};

export type TaskPatch = Partial<Omit<NewTask, "title">> & { title?: string };
